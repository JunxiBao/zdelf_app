/**
 * daily.js — Daily page logic (runs inside a Shadow DOM)
 * 日常页脚本：在 Shadow DOM 内运行
 *
 * Responsibilities / 职责
 * - Render greeting based on time & username / 根据时间与用户名显示问候语
 * - Load and display user data cards / 加载并显示用户数据卡片
 * - Expose lifecycle hooks: initDaily(shadowRoot), destroyDaily() / 导出生命周期钩子
 *
 * This module is loaded dynamically by the shell (index.js) and receives the
 * page's ShadowRoot via initDaily(shadowRoot). All DOM lookups must be scoped
 * to that ShadowRoot to avoid leaking to the host document.
 * 本模块由外壳(index.js)动态加载，通过 initDaily(shadowRoot) 接收子页的 ShadowRoot。
 * 所有 DOM 查询都应使用该 ShadowRoot，避免影响宿主文档。
 */

(function () {
  'use strict';
  // Backend API base: absolute by default; can be overridden via window.__API_BASE__
  const __API_BASE_DEFAULT__ = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
  const __API_BASE__ = __API_BASE_DEFAULT__ && __API_BASE_DEFAULT__.endsWith('/')
    ? __API_BASE_DEFAULT__.slice(0, -1)
    : __API_BASE_DEFAULT__;
  console.debug('[daily] daily.js 已加载');
  let cleanupFns = [];
  let fetchController = null;
  function abortInFlight() {
    if (fetchController) {
      try { fetchController.abort(); } catch (_) {}
    }
    fetchController = null;
  }

// -----------------------------
// State / 模块状态
// -----------------------------
let dailyRoot = document; // Will be set by initDaily(shadowRoot) / 将由 initDaily 赋值

// -----------------------------
// Utilities / 工具函数
// -----------------------------
/**
 * getGreeting — Return a localized greeting string based on current hour.
 * 根据当前小时返回合适的问候语。
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "早上好"; // Good morning
  if (hour >= 12 && hour < 14) return "中午好"; // Good noon
  if (hour >= 14 && hour < 18) return "下午好"; // Good afternoon
  if (hour >= 18 && hour < 22) return "晚上好"; // Good evening
  return "夜深了"; // Late night
}

/**
 * displayGreeting — Render greeting into #greeting inside the current scope.
 * 在当前作用域（dailyRoot 或传入的 root）中，渲染 #greeting。
 *
 * @param {string} username - Display name / 要显示的用户名
 * @param {Document|ShadowRoot} [root=dailyRoot] - Scope to query / 查询作用域
 */
function displayGreeting(username, root = dailyRoot) {
  const scope = root || document;
  const el = scope.querySelector("#greeting"); // ShadowRoot has no getElementById
  if (!el) {
    console.error("❌ 未找到 greeting 元素 (scope=", scope, ")");
    return;
  }
  el.textContent = `${getGreeting()}，${username}`;
}

/**
 * showLoadingState — 显示统一的加载状态
 * 在屏幕中央显示加载动画
 */
function showLoadingState() {
  const loadingHtml = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载您的数据...</div>
    </div>
  `;
  
  // 在页面容器中添加加载状态
  const pageContainer = dailyRoot.querySelector('.page-container');
  if (pageContainer) {
    pageContainer.insertAdjacentHTML('beforeend', loadingHtml);
  }
}

/**
 * hideLoadingState — 隐藏加载状态
 */
function hideLoadingState() {
  const loadingContainer = dailyRoot.querySelector('.loading-container');
  if (loadingContainer) {
    loadingContainer.style.opacity = '0';
    setTimeout(() => {
      loadingContainer.remove();
    }, 300);
  }
}

// 缓存用户名，避免重复请求
let cachedUsername = null;
let usernameLoadPromise = null;

/**
 * loadUsername — 异步加载用户名并渲染问候语
 * 返回Promise以便与其他加载任务并行执行
 */
function loadUsername() {
  return new Promise((resolve) => {
    // 如果已经有缓存的用户名，直接使用
    if (cachedUsername !== null) {
      console.log('📦 使用缓存的用户名:', cachedUsername);
      displayGreeting(cachedUsername, dailyRoot);
      resolve();
      return;
    }

    // 如果正在加载中，等待加载完成
    if (usernameLoadPromise) {
      console.log('⏳ 等待用户名加载完成...');
      usernameLoadPromise.then(() => {
        displayGreeting(cachedUsername || '访客', dailyRoot);
        resolve();
      });
      return;
    }

    const userId = localStorage.getItem('userId');
    console.log('🧪 获取到的 userId:', userId);

    if (!userId || userId === 'undefined' || userId === 'null') {
      console.warn('⚠️ 未获取到有效 userId，显示访客');
      cachedUsername = '访客';
      displayGreeting('访客', dailyRoot);
      resolve();
      return;
    }

    // 在发起新的请求前中止旧的
    abortInFlight();
    fetchController = new AbortController();

    // 创建加载Promise
    usernameLoadPromise = new Promise((resolveLoad) => {
      console.log('🌐 测试网络连接...');
      fetch(__API_BASE__ + '/readdata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'users', user_id: userId }),
        signal: fetchController.signal,
      })
        .then((response) => {
          console.log('📡 收到响应，状态码:', response.status);
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        })
        .then((data) => {
          console.log('📦 返回数据：', data);
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            cachedUsername = data.data[0].username || '访客';
          } else {
            cachedUsername = '访客';
          }
          resolveLoad();
        })
        .catch((error) => {
          if (error && error.name === 'AbortError') {
            console.warn('⏹️ 请求已取消');
          } else {
            console.error('❌ 获取用户信息失败:', error);
          }
          cachedUsername = '访客';
          resolveLoad();
        })
        .finally(() => {
          // 清理 controller 引用
          fetchController = null;
          usernameLoadPromise = null;
        });
    });

    // 等待加载完成
    usernameLoadPromise.then(() => {
      displayGreeting(cachedUsername, dailyRoot);
      resolve();
    });
  });
}

// -----------------------------
// Lifecycle / 生命周期
// -----------------------------
/**
 * initDaily — Boot the daily page inside the provided ShadowRoot.
 * 在传入的 ShadowRoot 中启动日常页逻辑。
 *
 * @param {ShadowRoot} shadowRoot - Shadow root for this page / 本页的 ShadowRoot
 */
function initDaily(shadowRoot) {
  // Cache and use the ShadowRoot / 记录并使用 ShadowRoot
  dailyRoot = shadowRoot || document;
  console.log('✅ initDaily 执行', { hasShadowRoot: !!shadowRoot });

  // 启动前中止可能在途的请求
  abortInFlight();

  // 显示统一的加载状态
  showLoadingState();

  // 初始化日期选择器
  initDatePicker();

  // 初始化搜索框
  initSearchBox();

  // 初始化数据类型切换器
  initDataTypeSwitcher();

  // 并行加载问候语和数据卡片
  Promise.all([
    loadUsername(),
    loadUserDataCards()
  ]).finally(() => {
    // 隐藏加载状态
    hideLoadingState();
  });
}

// 缓存数据卡片，避免重复请求
let cachedDataCards = null;
let dataCardsLoadPromise = null;

// 当前选择的日期
let selectedDate = null;

// 当前搜索关键字
let searchKeyword = '';

// 当前选择的数据类型
let selectedDataType = 'metrics';

/**
 * initSearchBox — 初始化搜索框
 */
function initSearchBox() {
  const searchInput = dailyRoot.querySelector('#search-input');
  const clearBtn = dailyRoot.querySelector('#clear-search-btn');
  
  if (!searchInput || !clearBtn) {
    console.warn('⚠️ 未找到搜索框元素');
    return;
  }

  // 初始隐藏清除按钮
  clearBtn.classList.add('hidden');

  // 搜索输入事件
  searchInput.addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    console.log('🔍 搜索关键字:', searchKeyword);
    
    // 显示或隐藏清除按钮
    if (searchKeyword) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
    
    // 过滤并重新渲染卡片
    filterAndRenderCards();
  });

  // 清除搜索按钮事件
  clearBtn.addEventListener('click', () => {
    // 添加震动反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    
    searchKeyword = '';
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    console.log('🗑️ 清除搜索');
    
    // 重新渲染所有卡片
    filterAndRenderCards();
  });

  // 搜索框聚焦事件
  searchInput.addEventListener('focus', () => {
    // 添加震动反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
  });
}

/**
 * initDataTypeSwitcher — 初始化数据类型切换器
 */
function initDataTypeSwitcher() {
  const switcherButtons = dailyRoot.querySelectorAll('.type-switch-btn');
  
  if (!switcherButtons.length) {
    console.warn('⚠️ 未找到数据类型切换器按钮');
    return;
  }

  // 为每个切换按钮添加点击事件
  switcherButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      
      // 添加震动反馈
      if (window.__hapticImpact__) {
        window.__hapticImpact__('Medium');
      }
      
      const dataType = button.dataset.type;
      
      // 更新选中状态
      switcherButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // 更新当前选择的数据类型
      selectedDataType = dataType;
      
      console.log(`🔄 切换到数据类型: ${dataType}`);
      
      // 重新过滤并渲染卡片
      filterAndRenderCards();
    });
  });
  
  console.log('✅ 数据类型切换器初始化完成');
}

/**
 * initDatePicker — 初始化日期选择器
 */
function initDatePicker() {
  const datePicker = dailyRoot.querySelector('#date-picker');
  const datePickerIcon = dailyRoot.querySelector('#date-picker-icon');
  const clearBtn = dailyRoot.querySelector('#clear-date-btn');
  
  if (!datePicker || !datePickerIcon || !clearBtn) {
    console.warn('⚠️ 未找到日期选择器元素');
    return;
  }

  // 设置默认日期为当前日期
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  datePicker.value = todayString;
  selectedDate = todayString;
  
  // 隐藏清除按钮（不再显示叉叉）
  clearBtn.classList.add('hidden');

  // 点击图标触发日期选择器
  datePickerIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 添加震动反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
    
    // 尝试多种方法触发日期选择器
    try {
      // 方法1: 使用showPicker API (现代浏览器)
      if (datePicker.showPicker) {
        datePicker.showPicker();
      } else {
        // 方法2: 传统方法
        datePicker.focus();
        datePicker.click();
      }
    } catch (error) {
      console.warn('无法触发日期选择器:', error);
      // 方法3: 备用方法
      try {
        datePicker.click();
      } catch (fallbackError) {
        console.error('所有方法都失败了:', fallbackError);
      }
    }
  });

  // 备用方法：直接点击隐藏的input
  datePicker.addEventListener('click', (e) => {
    // 添加震动反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
    console.log('日期选择器被点击');
  });

  // 日期选择器变化事件
  datePicker.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    console.log('📅 选择日期:', selectedDate);
    
    // 保持清除按钮隐藏（不再显示叉叉）
    clearBtn.classList.add('hidden');
    
    // 过滤并重新渲染卡片
    filterAndRenderCards();
  });

  // 清除日期按钮事件（重置为当前日期）
  clearBtn.addEventListener('click', () => {
    // 添加震动反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    
    // 重置为当前日期
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    selectedDate = todayString;
    datePicker.value = todayString;
    clearBtn.classList.add('hidden');
    console.log('🔄 重置为当前日期');
    
    // 重新渲染所有卡片
    filterAndRenderCards();
  });
}

/**
 * filterAndRenderCards — 根据选择的日期和搜索关键字过滤并渲染卡片
 */
function filterAndRenderCards() {
  if (!cachedDataCards) {
    console.warn('⚠️ 没有缓存的数据卡片');
    return;
  }

  const cardsContainer = dailyRoot.querySelector('#data-cards-container');
  if (!cardsContainer) {
    console.warn('⚠️ 未找到卡片容器');
    return;
  }

  let filteredCards = cachedDataCards;

  // 如果选择了日期，进行日期过滤
  if (selectedDate) {
    // 饮食/指标/病例均基于其内容内的记录日期过滤：
    // - 饮食：在 renderDietTimeline 内按每餐的 date/timestamp 过滤
    // - 指标/病例：在 updateTimelineDetails 内按 exportInfo.recordDate 过滤
    // 因此此处不再按 created_at 预过滤，避免漏掉“补录”的数据
  }

  // 如果有搜索关键字，进行搜索过滤
  if (searchKeyword) {
    filteredCards = filteredCards.filter(item => {
      return searchInCardData(item, searchKeyword);
    });
    
    console.log(`🔍 按关键字 "${searchKeyword}" 过滤，从 ${cachedDataCards.length} 条记录中筛选出 ${filteredCards.length} 条`);
  }

  // 按数据类型过滤
  if (selectedDataType) {
    filteredCards = filteredCards.filter(item => {
      return item.dataType === selectedDataType;
    });
    
    console.log(`🏷️ 按数据类型 "${selectedDataType}" 过滤，从 ${cachedDataCards.length} 条记录中筛选出 ${filteredCards.length} 条`);
  }

  // 渲染过滤后的卡片
  const renderPromise = selectedDataType === 'diet'
    ? renderDietTimeline(filteredCards, cardsContainer)
    : renderTimelineItems(filteredCards, cardsContainer);

  renderPromise.catch(err => {
    console.error('渲染过滤后的卡片失败:', err);
    cardsContainer.innerHTML = `
      <div class="no-data-message">
        <div class="no-data-icon">⚠️</div>
        <h3>筛选失败</h3>
        <p>请刷新页面重试</p>
      </div>
    `;
  });
}

/**
 * searchInCardData — 在卡片数据中搜索关键字
 * @param {Object} item - 卡片数据项
 * @param {string} keyword - 搜索关键字
 * @returns {boolean} - 是否匹配
 */
function searchInCardData(item, keyword) {
  if (!keyword) return true;
  
  const lowerKeyword = keyword.toLowerCase();
  
  // 搜索文件名
  if (item.file_name && item.file_name.toLowerCase().includes(lowerKeyword)) {
    return true;
  }
  
  // 搜索创建时间
  if (item.created_at && item.created_at.toLowerCase().includes(lowerKeyword)) {
    return true;
  }
  
  // 搜索数据类型
  if (item.dataType && item.dataType.toLowerCase().includes(lowerKeyword)) {
    return true;
  }
  
  // 搜索内容摘要（如果有的话）
  if (item.content) {
    const contentStr = JSON.stringify(item.content).toLowerCase();
    if (contentStr.includes(lowerKeyword)) {
      return true;
    }
  }
  
  // 搜索预览数据（如果有的话）
  if (item.preview) {
    const previewStr = JSON.stringify(item.preview).toLowerCase();
    if (previewStr.includes(lowerKeyword)) {
      return true;
    }
  }
  
  return false;
}

/**
 * searchInCardContent — 在卡片详细内容中搜索关键字
 * @param {Object} content - 卡片详细内容
 * @param {string} dataType - 数据类型
 * @param {string} keyword - 搜索关键字
 * @returns {boolean} - 是否匹配
 */
function searchInCardContent(content, dataType, keyword) {
  if (!keyword) return true;
  
  const lowerKeyword = keyword.toLowerCase();
  console.log(`🔍 在 ${dataType} 内容中搜索 "${lowerKeyword}"`);
  
  // 将内容转换为字符串进行搜索
  const contentStr = JSON.stringify(content).toLowerCase();
  if (contentStr.includes(lowerKeyword)) {
    console.log(`✅ 在JSON字符串中找到匹配: "${lowerKeyword}"`);
    return true;
  }
  
  // 根据数据类型进行特定搜索
  let result = false;
  switch (dataType) {
    case 'metrics':
      result = searchInMetricsContent(content, lowerKeyword);
      break;
    case 'diet':
      result = searchInDietContent(content, lowerKeyword);
      break;
    case 'case':
      result = searchInCaseContent(content, lowerKeyword);
      break;
    default:
      result = false;
  }
  
  console.log(`🔍 ${dataType} 特定搜索结果:`, result);
  return result;
}

/**
 * searchInMetricsContent — 在健康指标内容中搜索
 */
function searchInMetricsContent(content, keyword) {
  const metricsData = content.metricsData || {};
  
  // 搜索症状
  if (metricsData.symptoms?.symptoms && metricsData.symptoms.symptoms.toLowerCase().includes(keyword)) {
    return true;
  }
  
  // 搜索体温
  if (metricsData.temperature?.temperature && metricsData.temperature.temperature.toString().includes(keyword)) {
    return true;
  }
  
  // 搜索尿常规
  if (metricsData.urinalysis) {
    const urinalysis = metricsData.urinalysis;
    if (urinalysis.protein && urinalysis.protein.toLowerCase().includes(keyword)) return true;
    if (urinalysis.glucose && urinalysis.glucose.toLowerCase().includes(keyword)) return true;
    if (urinalysis.ketones && urinalysis.ketones.toLowerCase().includes(keyword)) return true;
    if (urinalysis.blood && urinalysis.blood.toLowerCase().includes(keyword)) return true;
  }
  
  // 搜索24h尿蛋白
  if (metricsData.proteinuria?.proteinuria24h && metricsData.proteinuria.proteinuria24h.toString().includes(keyword)) {
    return true;
  }
  
  // 搜索血常规
  if (metricsData['blood-test']) {
    const blood = metricsData['blood-test'];
    if (blood.wbc && blood.wbc.toString().includes(keyword)) return true;
    if (blood.rbc && blood.rbc.toString().includes(keyword)) return true;
    if (blood.hb && blood.hb.toString().includes(keyword)) return true;
    if (blood.plt && blood.plt.toString().includes(keyword)) return true;
  }
  
  // 搜索出血点
  if (metricsData['bleeding-point']?.bleedingPoint) {
    const bleeding = metricsData['bleeding-point'];
    const bleedingText = getBleedingPointText(bleeding.bleedingPoint);
    if (bleedingText.toLowerCase().includes(keyword)) return true;
    if (bleeding.otherDescription && bleeding.otherDescription.toLowerCase().includes(keyword)) return true;
  }
  
  // 搜索自我评分
  if (metricsData['self-rating']?.selfRating !== undefined && metricsData['self-rating'].selfRating.toString().includes(keyword)) {
    return true;
  }
  
  // 搜索血常规检测矩阵
  if (metricsData['blood-test-matrix']?.bloodTestMatrix) {
    const matrix = metricsData['blood-test-matrix'].bloodTestMatrix;
    for (const item of matrix) {
      if (item.item && item.item.toLowerCase().includes(keyword)) return true;
      if (item.value && item.value.toString().toLowerCase().includes(keyword)) return true;
      // 搜索自定义项目名称
      if (item.customName && item.customName.toLowerCase().includes(keyword)) return true;
    }
  }
  
  // 搜索尿液检测矩阵
  if (metricsData['urinalysis-matrix']?.urinalysisMatrix) {
    const matrix = metricsData['urinalysis-matrix'].urinalysisMatrix;
    for (const item of matrix) {
      if (item.item && item.item.toLowerCase().includes(keyword)) return true;
      if (item.value && item.value.toString().toLowerCase().includes(keyword)) return true;
      // 搜索自定义项目名称
      if (item.customName && item.customName.toLowerCase().includes(keyword)) return true;
    }
  }
  
  return false;
}

/**
 * searchInDietContent — 在饮食记录内容中搜索
 */
function searchInDietContent(content, keyword) {
  const dietData = content.dietData || {};
  
  for (const meal of Object.values(dietData)) {
    if (meal.time && meal.time.toLowerCase().includes(keyword)) return true;
    if (meal.food && meal.food.toLowerCase().includes(keyword)) return true;
  }
  
  return false;
}

/**
 * searchInCaseContent — 在病例记录内容中搜索
 */
function searchInCaseContent(content, keyword) {
  // 这里可以根据实际的病例数据结构来实现
  const contentStr = JSON.stringify(content).toLowerCase();
  return contentStr.includes(keyword);
}

/**
 * loadUserDataCards — 加载并显示用户数据卡片
 * 从后端获取所有用户数据并按时间排序展示
 * 返回Promise以便与其他加载任务并行执行
 */
function loadUserDataCards() {
  return new Promise((resolve) => {
    const userId = localStorage.getItem('userId') || 
                   localStorage.getItem('UserID') || 
                   sessionStorage.getItem('userId') || 
                   sessionStorage.getItem('UserID');
    
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.warn('⚠️ 未获取到有效 userId，跳过数据卡片加载');
      resolve();
      return;
    }

    // 创建卡片容器
    const cardsContainer = dailyRoot.querySelector('#data-cards-container');
    if (!cardsContainer) {
      console.warn('⚠️ 未找到卡片容器 #data-cards-container');
      resolve();
      return;
    }

    // 如果正在加载中，等待加载完成
    if (dataCardsLoadPromise) {
      console.log('⏳ 等待数据卡片加载完成...');
      dataCardsLoadPromise.then(() => {
        if (cachedDataCards) {
          renderTimelineItems(cachedDataCards, cardsContainer).catch(err => {
            console.error('渲染缓存卡片失败:', err);
          });
        }
        resolve();
      });
      return;
    }

    // 创建加载Promise
    dataCardsLoadPromise = new Promise((resolveLoad) => {
      // 并行加载所有类型的数据（带所选日期筛选，后端做初筛）
      const dataTypes = ['metrics', 'diet', 'case'];
      const dateParam = selectedDate ? `&date=${encodeURIComponent(getDateYMD(String(selectedDate)))}` : '';
      const promises = dataTypes.map(type => 
        fetch(`${__API_BASE__}/getjson/${type}?user_id=${encodeURIComponent(userId)}&limit=50${dateParam}`)
          .then(res => res.json())
          .then(data => ({ type, data }))
          .catch(err => {
            console.warn(`加载 ${type} 数据失败:`, err);
            return { type, data: { success: false, data: [] } };
          })
      );

      Promise.all(promises).then(async results => {
        // 合并所有数据
        const baseItems = [];
        results.forEach(({ type, data }) => {
          if (data.success && data.data) {
            data.data.forEach(item => {
              baseItems.push({
                ...item,
                dataType: type
              });
            });
          }
        });

        // 预取每条记录的 exportInfo 以获得排序用的 recordTime（回退 exportTime 或 created_at）
        const augmented = await Promise.all(baseItems.map(async (it) => {
          try {
            const res = await fetch(`${__API_BASE__}/getjson/${it.dataType}/${it.id}`);
            const detail = await res.json();
            const exp = (detail && detail.data && detail.data.exportInfo) || {};
            const sortTime = exp.recordTime || exp.exportTime || it.created_at;
            return { ...it, sortTime };
          } catch (_) {
            return { ...it, sortTime: it.created_at };
          }
        }));

        // 按记录时间（recordTime 优先）降序排序
        augmented.sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));

        // 缓存数据
        cachedDataCards = augmented;
        resolveLoad();
      }).catch(err => {
        console.error('加载数据失败:', err);
        cachedDataCards = [];
        resolveLoad();
      });
    });

    // 等待加载完成
    dataCardsLoadPromise.then(() => {
      if (cachedDataCards) {
        // 使用过滤函数渲染卡片（会根据当前选择的日期进行过滤）
        filterAndRenderCards();
        resolve();
      } else {
        cardsContainer.innerHTML = `
          <div class="no-data-message">
            <div class="no-data-icon">⚠️</div>
            <h3>加载失败</h3>
            <p>请刷新页面重试</p>
          </div>
        `;
        resolve();
      }
    }).finally(() => {
      dataCardsLoadPromise = null;
    });
  });
}

/**
 * renderTimelineItems — 渲染时间线项目（异步获取完整数据）
 */
async function renderTimelineItems(items, container) {
  if (items.length === 0) {
    // 如果没有传入任何项目，显示无数据消息
    let message;
    
    if (selectedDate && searchKeyword) {
      message = `
        <div class="no-data-message">
          <div class="no-data-icon">🔍</div>
          <h3>未找到匹配的记录</h3>
          <p>在 ${selectedDate} 中没有找到包含 "${searchKeyword}" 的记录</p>
          <p>尝试调整搜索条件或清除筛选</p>
        </div>
      `;
    } else if (selectedDate) {
      message = `
        <div class="no-data-message">
          <div class="no-data-icon">📅</div>
          <h3>该日期无数据记录</h3>
          <p>选择其他日期或清除筛选查看所有记录</p>
        </div>
      `;
    } else if (searchKeyword) {
      message = `
        <div class="no-data-message">
          <div class="no-data-icon">🔍</div>
          <h3>未找到匹配的记录</h3>
          <p>没有找到包含 "${searchKeyword}" 的记录</p>
          <p>尝试其他关键字或清除搜索</p>
        </div>
      `;
    } else {
      message = `
        <div class="no-data-message">
          <div class="no-data-icon">📝</div>
          <h3>暂无数据记录</h3>
          <p>开始记录您的健康数据吧</p>
        </div>
      `;
    }
    
    container.innerHTML = message;
    return;
  }

  console.log(`🎨 开始渲染 ${items.length} 个时间线项目`);

  // 按时间分组数据
  const groupedData = groupDataByTime(items);
  
  // 创建时间线容器
  const timelineHTML = `
    <div class="timeline-container">
      <div class="timeline-line"></div>
      ${await generateTimelineItems(groupedData)}
    </div>
  `;
  
  container.innerHTML = timelineHTML;
  
  // 添加点击事件监听器
  container.querySelectorAll('.timeline-content').forEach(content => {
    // 饮食记录/个人病例按需求直接在时间线上完全展开，不再弹出详情
    if (content.dataset.type === 'diet' || content.dataset.type === 'case') return;
    
    content.addEventListener('click', () => {
      const fileId = content.dataset.fileId;
      const dataType = content.dataset.type;
      console.log(`点击时间线项目: ${dataType} - ${fileId}`);
      
      // 添加震动反馈
      if (window.__hapticImpact__) {
        window.__hapticImpact__('Medium');
      }
      
      // 显示详情模态框
      showDetailModal(fileId, dataType);
    });
  });
  
  console.log(`✅ 成功渲染时间线，包含 ${Object.keys(groupedData).length} 个时间组`);
}

/**
 * renderDietTimeline — 将饮食记录拆分到每一餐各自的时间点
 * 规则：
 * - 仍按记录的 created_at 对原始文件聚合排序，以保证时间线顺序稳定
 * - 但每条饮食记录会被拆分为多条"餐事件"，各自用餐时间 HH:mm 作为时间点
 * - 紫色时间显示用餐时间，内容展示该餐的详情
 */
async function renderDietTimeline(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="no-data-message">
        <div class="no-data-icon">📝</div>
        <h3>暂无饮食记录</h3>
        <p>开始记录您的饮食数据吧</p>
      </div>
    `;
    return;
  }

  // 1) 先按记录时间排序（餐事件自身仍按餐时间展示）
  const sorted = items.slice().sort((a, b) => {
    const ta = a.sortTime || a.created_at;
    const tb = b.sortTime || b.created_at;
    return new Date(ta) - new Date(tb);
  });

  // 2) 拉取详情并拆分为餐事件（使用每餐的日期/时间进行过滤）
  const mealEvents = [];
  for (const item of sorted) {
    try {
      const res = await fetch(`${__API_BASE__}/getjson/${item.dataType}/${item.id}`);
      const detail = await res.json();
      if (!detail.success) continue;
      const content = detail.data?.content || {};
      const dietData = content.dietData || {};
      const exportInfo = content.exportInfo || {};
      // 解析页面选择的 targetDateStr（严格字符串，不做时区换算）
      const targetDateStr = selectedDate ? getDateYMD(String(selectedDate)) : null;

      Object.values(dietData).forEach((meal) => {
        if (!meal || !meal.time) return;
        // 取每餐的日期优先级：meal.date -> meal.timestamp(YYYY-MM-DD 开头) -> exportInfo.recordTime 的日期部分
        let mealDateStr = '';
        if (meal.date && /^\d{4}-\d{2}-\d{2}$/.test(meal.date)) {
          mealDateStr = meal.date;
        } else if (meal.timestamp && /^\d{4}-\d{2}-\d{2}/.test(meal.timestamp)) {
          mealDateStr = meal.timestamp.slice(0,10);
        } else if (exportInfo && (exportInfo.recordTime || exportInfo.exportTime)) {
          mealDateStr = getDateYMD(exportInfo.recordTime || exportInfo.exportTime);
        }

        // 若选择了日期，仅保留匹配该日期的餐事件（严格匹配，缺失日期的餐次不纳入该日）
        if (targetDateStr) {
          if (mealDateStr !== targetDateStr) return;
        }

        mealEvents.push({
          timeHM: String(meal.time).slice(0,5),
          food: meal.food || '',
          images: Array.isArray(meal.images) ? meal.images : [],
          fileId: item.id,
          date: mealDateStr || ''
        });
      });
    } catch (_) {}
  }

  if (mealEvents.length === 0) {
    container.innerHTML = '<p>暂无饮食记录</p>';
    return;
  }

  // 3) 按餐时间升序分组
  const grouped = {};
  mealEvents
    .sort((a,b)=>{
      const [ah,am]=a.timeHM.split(':').map(Number); const [bh,bm]=b.timeHM.split(':').map(Number);
      return (ah*60+am)-(bh*60+bm);
    })
    .forEach(ev=>{
      if(!grouped[ev.timeHM]) grouped[ev.timeHM]=[];
      grouped[ev.timeHM].push(ev);
    });

  // 4) 生成时间线HTML（适配深色模式）
  const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const mealCardStyle = isDark
    ? "background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 12px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);"
    : "background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; padding: 16px; border: 1px solid rgba(0, 0, 0, 0.06); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);";
  const foodTextStyle = isDark ? "margin:0; color:#cbd5e1;" : "margin:0; color:#475569;";

  let html = '<div class="timeline-container">\n  <div class="timeline-line"></div>';
  Object.entries(grouped).forEach(([time, events])=>{
    const itemsHtml = events.map((ev)=>{
      return `
        <div class="timeline-content" data-type="diet" data-file-id="${ev.fileId}">
          <div class="content-summary">
            <div style="${mealCardStyle}">
              ${ev.food ? `<p style="${foodTextStyle}"><strong>食物：</strong>${ev.food}</p>` : ''}
              ${ev.images && ev.images.length ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 8px;">
                  ${ev.images.map((src, i) => `
                    <div style="position: relative;"> 
                      <img src="${src}" alt="饮食图片 ${i+1}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.08);" onclick="openImageModal('${src}')" />
                      <div style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.55); color: #fff; padding: 2px 6px; border-radius: 6px; font-size: 12px;">${i+1}</div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    html += `
      <div class="timeline-item">
        <div class="timeline-node"></div>
        <div class="timeline-time">${time}</div>
        ${itemsHtml}
      </div>
    `;
  });
  html += '</div>';

  container.innerHTML = html;
}

/**
 * groupDataByTime — 按时间分组数据
 */
function groupDataByTime(items) {
  const groups = {};
  
  items.forEach(item => {
    const baseTime = item.sortTime || item.created_at;
    const timeKey = getTimeHMFromCreatedAt(baseTime);
    
    if (!groups[timeKey]) {
      groups[timeKey] = [];
    }
    groups[timeKey].push(item);
  });
  
  // 按 HH:mm 升序排序，且在同一时间点内按记录时间稳定排序
  const sortedGroups = {};
  Object.keys(groups)
    .sort((a, b) => {
      const [ah, am] = a.split(':').map(Number);
      const [bh, bm] = b.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    })
    .forEach(time => {
      sortedGroups[time] = groups[time].slice().sort((i1, i2) => {
        const t1 = getTimeHMFromCreatedAt(i1.sortTime || i1.created_at);
        const t2 = getTimeHMFromCreatedAt(i2.sortTime || i2.created_at);
        const [h1, m1] = t1.split(':').map(Number);
        const [h2, m2] = t2.split(':').map(Number);
        return (h1 * 60 + m1) - (h2 * 60 + m2);
      });
    });
  
  return sortedGroups;
}

/**
 * getTimeHMFromCreatedAt — 稳定地从 created_at 提取北京时间 HH:mm
 * 兼容多种后端时间格式，避免被浏览器当作 UTC 导致+8小时偏移
 */
function getTimeHMFromCreatedAt(createdAt) {
  if (!createdAt) return '00:00';
  if (typeof createdAt === 'string') {
    // 1) 直接是北京时间字符串: 2025/09/21 09:34:43
    const slashFmt = /^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/;
    const m1 = createdAt.match(slashFmt);
    if (m1) {
      const hh = m1[4].padStart(2, '0');
      const mm = m1[5].padStart(2, '0');
      return `${hh}:${mm}`;
    }
    // 2) MySQL 常见格式: 2025-09-21 09:34:43（按本地时间处理，不做时区换算）
    const mysqlFmt = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
    const m2 = createdAt.match(mysqlFmt);
    if (m2) {
      const hh = m2[4];
      const mm = m2[5];
      return `${hh}:${mm}`;
    }
  }
  // 3) 其他如 ISO 字符串，使用 Asia/Shanghai 规范化
  try {
    const d = new Date(createdAt);
    return d.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch (_) {
    return '00:00';
  }
}

/**
 * getDateYMD — 将任意日期/时间值安全提取为 YYYY-MM-DD（使用 Asia/Shanghai）
 */
function getDateYMD(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    // 直接从字符串头部提取 yyyy-mm-dd 或 yyyy/mm/dd 或 yyyy.mm.dd
    const m = value.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  try {
    const d = new Date(value);
    const y = d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric' });
    const mo = d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit' });
    const da = d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', day: '2-digit' });
    return `${y}-${mo}-${da}`;
  } catch (_) {
    return '';
  }
}

/**
 * generateTimelineItems — 生成时间线项目HTML（优化版本）
 */
async function generateTimelineItems(groupedData) {
  const timelineItems = [];
  
  for (const [time, items] of Object.entries(groupedData)) {
    // 先快速生成基础HTML，不等待API请求
    const itemHTMLs = items.map(item => {
      return `
        <div class="timeline-content" data-file-id="${item.id}" data-type="${item.dataType}">
          <div class="content-type-badge ${item.dataType}">${getTypeTitle(item.dataType)}</div>
          <div class="content-summary">正在加载详细信息...</div>
        </div>
      `;
    });
    
    timelineItems.push(`
      <div class="timeline-item">
        <div class="timeline-node"></div>
        <div class="timeline-time">${time}</div>
        ${itemHTMLs.join('')}
      </div>
    `);
  }
  
  // 先返回基础HTML，让用户立即看到时间线结构
  const basicHTML = timelineItems.join('');
  
  // 然后异步加载详细信息并更新内容
  setTimeout(async () => {
    await updateTimelineDetails(groupedData);
  }, 100);
  
  return basicHTML;
}

/**
 * updateTimelineDetails — 异步更新时间线详细信息
 */
async function updateTimelineDetails(groupedData) {
  const timelineContainer = dailyRoot.querySelector('.timeline-container');
  if (!timelineContainer) return;
  // 统一解析日期筛选目标
  let targetDateStr = null;
  if (selectedDate) {
    targetDateStr = getDateYMD(String(selectedDate));
  }
  
  for (const [time, items] of Object.entries(groupedData)) {
    // 找到对应的时间线项目
    const timelineItems = timelineContainer.querySelectorAll('.timeline-item');
    let targetTimelineItem = null;
    
    for (const timelineItem of timelineItems) {
      const timeElement = timelineItem.querySelector('.timeline-time');
      if (timeElement && timeElement.textContent.trim() === time) {
        targetTimelineItem = timelineItem;
        break;
      }
    }
    
    if (!targetTimelineItem) continue;
    
    const contentElements = targetTimelineItem.querySelectorAll('.timeline-content');
    
    // 若为饮食/病例/指标视图，紫色时间显示记录时间：
  // - 饮食：在 renderDietTimeline 已用每餐时间
  // - 病例/指标：使用 exportInfo.recordTime（若不可用，退回 exportTime）
    let overrideTimeHM = null;
    
    for (let i = 0; i < items.length && i < contentElements.length; i++) {
      const item = items[i];
      const contentElement = contentElements[i];
      
      try {
        // 获取完整数据
        const response = await fetch(`${__API_BASE__}/getjson/${item.dataType}/${item.id}`);
        const detailData = await response.json();
        
        if (detailData.success) {
          const content = detailData.data.content || {};

          // 指标/病例：按记录日期过滤
          // - 病例：严格使用 exportInfo.recordTime 的日期部分，缺失则在选中日期时不展示
          // - 指标：使用 exportInfo.recordTime 的日期部分；缺失时回退 exportTime，再回退 created_at
          if (targetDateStr && (item.dataType === 'metrics' || item.dataType === 'case')) {
            const exp = detailData.data?.exportInfo || content.exportInfo || {};
            if (item.dataType === 'case') {
              const rt = exp.recordTime;
              if (!rt) { contentElement.style.display = 'none'; continue; }
              let rtDate = '';
              try { rtDate = new Date(rt).toISOString().split('T')[0]; } catch(_) { rtDate = ''; }
              if (rtDate !== targetDateStr) { contentElement.style.display = 'none'; continue; }
            } else {
              const primary = exp.recordTime || '';
              const fallback1 = exp.exportTime || '';
              let candidate = primary || fallback1 || item.created_at || '';
              let candidateDate = '';
              try { candidateDate = new Date(candidate).toISOString().split('T')[0]; } catch(_) { candidateDate = ''; }
              if (candidateDate && candidateDate !== targetDateStr) { contentElement.style.display = 'none'; continue; }
            }
          }
          
          // 如果有搜索关键字，检查详细内容是否匹配
          if (searchKeyword) {
            const matches = searchInCardContent(content, item.dataType, searchKeyword);
            if (!matches) {
              contentElement.style.display = 'none';
              continue;
            }
          }
          
          // 饮食记录：直接在时间线上完全展开，不使用摘要
          const summaryElement = contentElement.querySelector('.content-summary');
          if (summaryElement) {
            if (item.dataType === 'diet') {
              // 移除类型角标，保持简洁
              const badge = contentElement.querySelector('.content-type-badge');
              if (badge) badge.remove();
              const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              summaryElement.innerHTML = formatDietForDisplay(content, isDark);
              // 饮食在 renderDietTimeline 已按餐时间渲染，不改紫色时间
            } else if (item.dataType === 'case') {
              // 病例记录：在时间线上完全展开
              const badge = contentElement.querySelector('.content-type-badge');
              if (badge) badge.remove();
              const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              summaryElement.innerHTML = formatCaseForDisplay(content, isDark);
              const recordTime = detailData.data?.exportInfo?.recordTime || content.exportInfo?.recordTime;
              const fallback = detailData.data?.exportInfo?.exportTime || content.exportInfo?.exportTime;
              const useTime = recordTime || fallback;
              if (useTime) {
                overrideTimeHM = getTimeHMFromCreatedAt(useTime);
              }
            } else {
              const summary = parseContentToSummary(content, item.dataType);
              summaryElement.innerHTML = summary;
              // 健康指标：优先 recordTime，其次 exportTime
              if (item.dataType === 'metrics') {
                const recordTime = detailData.data?.exportInfo?.recordTime || content.exportInfo?.recordTime;
                const fallback = detailData.data?.exportInfo?.exportTime || content.exportInfo?.exportTime;
                const useTime = recordTime || fallback;
                if (useTime) {
                  overrideTimeHM = getTimeHMFromCreatedAt(useTime);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('获取详情失败:', err);
        const summaryElement = contentElement.querySelector('.content-summary');
        if (summaryElement) {
          summaryElement.innerHTML = '数据加载失败';
        }
      }
    }
    
    // 如果当前是非饮食视图，并拿到记录时间，则更新紫色时间
    if ((selectedDataType === 'case' || selectedDataType === 'metrics') && overrideTimeHM) {
      const timeEl = targetTimelineItem.querySelector('.timeline-time');
      if (timeEl) timeEl.textContent = overrideTimeHM;
    }
  }
}

/**
 * bindUnifiedCardEvents — 绑定统一卡片事件
 */
function bindUnifiedCardEvents(container) {
  // 点击卡片查看详情
  container.querySelectorAll('.unified-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__hapticImpact__) {
        window.__hapticImpact__('Medium');
      }
      const fileId = card.dataset.fileId;
      const type = card.dataset.type;
      showDetailModal(fileId, type);
    });
  });

  // 点击查看详情按钮
  container.querySelectorAll('.view-detail-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__hapticImpact__) {
        window.__hapticImpact__('Medium');
      }
      const card = btn.closest('.unified-card');
      const fileId = card.dataset.fileId;
      const type = card.dataset.type;
      showDetailModal(fileId, type);
    });
  });
}

/**
 * showDetailModal — 显示详情弹窗
 */
function showDetailModal(fileId, type) {
  // 检测深色模式
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // 创建弹窗 - 完全使用内联样式
  const modal = document.createElement('div');
  
  // 弹窗容器样式
  modal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
    z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 20px !important;
      box-sizing: border-box !important;
      width: 100vw !important;
      height: 100vh !important;
    margin: 0 !important;
  `;
  
  // 根据深色模式选择样式
  const backdropStyle = isDarkMode 
    ? "background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(12px);"
    : "background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(12px);";
    
  const modalContentStyle = isDarkMode
    ? "background: linear-gradient(145deg, #1f2937 0%, #111827 100%); border-radius: 28px; box-shadow: 0 32px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1); max-width: 90vw; max-height: calc(100vh - 120px); width: 100%; max-width: 700px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); margin: 0 auto; transform: translateZ(0);"
    : "background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%); border-radius: 28px; box-shadow: 0 32px 64px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6); max-width: 90vw; max-height: calc(100vh - 120px); width: 100%; max-width: 700px; overflow: hidden; border: none; margin: 0 auto; transform: translateZ(0);";
    
  const headerStyle = isDarkMode
    ? "display: flex; justify-content: space-between; align-items: center; padding: 28px 32px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: linear-gradient(135deg, #374151 0%, #1f2937 100%); color: #f9fafb; border-radius: 28px 28px 0 0;"
    : "display: flex; justify-content: space-between; align-items: center; padding: 28px 32px 24px; border-bottom: 1px solid rgba(0, 0, 0, 0.06); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 28px 28px 0 0;";
    
  const closeBtnStyle = isDarkMode
    ? "background: rgba(255, 255, 255, 0.1); border: none; font-size: 1.6rem; color: #d1d5db; cursor: pointer; padding: 12px; border-radius: 16px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;"
    : "background: rgba(255, 255, 255, 0.2); border: none; font-size: 1.6rem; color: white; cursor: pointer; padding: 12px; border-radius: 16px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;";
    
  const loadingTextStyle = isDarkMode
    ? "color: #9ca3af; font-size: 1rem; font-weight: 500;"
    : "color: #64748b; font-size: 1rem; font-weight: 500;";
  
  modal.innerHTML = `
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; ${backdropStyle}"></div>
    <div style="position: relative; ${modalContentStyle}">
      <div style="${headerStyle}">
        <h3 style="margin: 0; font-size: 1.5rem; font-weight: 700;">${getTypeTitle(type)} 详情</h3>
        <button style="${closeBtnStyle}">&times;</button>
      </div>
      <div style="padding: 32px; max-height: calc(100vh - 240px); overflow-y: auto;">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; min-height: 200px;">
          <div style="width: 48px; height: 48px; border: 4px solid rgba(102, 126, 234, 0.2); border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
          <div style="${loadingTextStyle}">正在加载详情...</div>
        </div>
      </div>
    </div>
  `;

  // 只添加动画样式
  const style = document.createElement('style');
  style.id = 'detail-modal-styles';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  modal.appendChild(style);
  
  // 将弹窗添加到主文档，而不是 Shadow DOM，以便正确控制滚动
  document.body.appendChild(modal);
  
  // 禁用页面滚动
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // 绑定关闭事件 - 使用内联样式的元素
  const closeBtn = modal.querySelector('button');
  const backdrop = modal.querySelector('div[style*="backdrop-filter"]');
  
  const closeModal = () => {
    // 恢复页面滚动
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    // 清理样式
    const existingStyle = document.getElementById('detail-modal-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    modal.remove();
  };
  
  closeBtn.addEventListener('click', () => {
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    closeModal();
  });
  
  backdrop.addEventListener('click', () => {
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    closeModal();
  });

  // 加载详情数据
  fetch(`${__API_BASE__}/getjson/${type}/${fileId}`)
    .then(res => res.json())
    .then(data => {
      console.log('详情数据加载成功:', data);
      if (data.success) {
        // 添加数据类型到数据对象中
        data.data.dataType = type;
        // 使用内联样式的选择器
        const modalBody = modal.querySelector('div[style*="padding: 32px"]');
        console.log('找到弹窗主体元素:', modalBody);
        renderDetailContent(data.data, modalBody);
      } else {
        const modalBody = modal.querySelector('div[style*="padding: 32px"]');
        modalBody.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">加载失败</p>';
      }
    })
    .catch(err => {
      console.error('加载详情失败:', err);
      const modalBody = modal.querySelector('div[style*="padding: 32px"]');
      modalBody.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">加载失败</p>';
    });
}

/**
 * showAllItemsModal — 显示全部项目弹窗
 */
function showAllItemsModal(type) {
  const userId = localStorage.getItem('userId') || 
                 localStorage.getItem('UserID') || 
                 sessionStorage.getItem('userId') || 
                 sessionStorage.getItem('UserID');

  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'all-items-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>全部 ${getTypeTitle(type)} 记录</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="loading">正在加载...</div>
      </div>
    </div>
  `;

  // 将弹窗添加到主文档，而不是 Shadow DOM，以便正确控制滚动
  document.body.appendChild(modal);
  
  // 禁用页面滚动
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // 绑定关闭事件
  const closeBtn = modal.querySelector('.close-btn');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  const closeModal = () => {
    // 恢复页面滚动
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    modal.remove();
  };
  
  closeBtn.addEventListener('click', () => {
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    closeModal();
  });
  
  backdrop.addEventListener('click', () => {
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    closeModal();
  });

  // 加载全部数据
  fetch(`${__API_BASE__}/getjson/${type}?user_id=${encodeURIComponent(userId)}&limit=100`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        renderAllItemsContent(data.data, type, modal.querySelector('.modal-body'));
      } else {
        modal.querySelector('.modal-body').innerHTML = '<p>加载失败</p>';
      }
    })
    .catch(err => {
      console.error('加载全部数据失败:', err);
      modal.querySelector('.modal-body').innerHTML = '<p>加载失败</p>';
    });
}

/**
 * parseContentToSummary — 解析内容为中文摘要
 */
function parseContentToSummary(content, dataType) {
  const metricsData = content.metricsData || {};
  const exportInfo = content.exportInfo || {};
  
  switch (dataType) {
    case 'metrics':
      return parseMetricsSummary(metricsData);
    case 'diet':
      return parseDietSummary(content);
    case 'case':
      return parseCaseSummary(content);
    default:
      return '未知数据类型';
  }
}

/**
 * parseMetricsSummary — 解析健康指标摘要
 */
function parseMetricsSummary(metricsData) {
  const summaries = [];
  
  // 症状
  if (metricsData.symptoms?.symptoms) {
    summaries.push(`症状: ${metricsData.symptoms.symptoms}`);
  }
  
  // 体温
  if (metricsData.temperature?.temperature) {
    summaries.push(`体温: ${metricsData.temperature.temperature}°C`);
  }
  
  // 尿常规
  if (metricsData.urinalysis) {
    const urinalysis = metricsData.urinalysis;
    const items = [];
    if (urinalysis.protein) items.push(`蛋白质: ${urinalysis.protein}`);
    if (urinalysis.glucose) items.push(`葡萄糖: ${urinalysis.glucose}`);
    if (urinalysis.ketones) items.push(`酮体: ${urinalysis.ketones}`);
    if (urinalysis.blood) items.push(`隐血: ${urinalysis.blood}`);
    if (items.length > 0) {
      summaries.push(`尿常规: ${items.join(', ')}`);
    }
  }
  
  // 24h尿蛋白
  if (metricsData.proteinuria?.proteinuria24h) {
    summaries.push(`24h尿蛋白: ${metricsData.proteinuria.proteinuria24h}g`);
  }
  
  // 血常规
  if (metricsData['blood-test']) {
    const blood = metricsData['blood-test'];
    const items = [];
    if (blood.wbc) items.push(`白细胞: ${blood.wbc}×10⁹/L`);
    if (blood.rbc) items.push(`红细胞: ${blood.rbc}×10¹²/L`);
    if (blood.hb) items.push(`血红蛋白: ${blood.hb}g/L`);
    if (blood.plt) items.push(`血小板: ${blood.plt}×10⁹/L`);
    if (items.length > 0) {
      summaries.push(`血常规: ${items.join(', ')}`);
    }
  }
  
  // 出血点
  if (metricsData['bleeding-point']?.bleedingPoint) {
    const bleeding = metricsData['bleeding-point'];
    let bleedingText = getBleedingPointText(bleeding.bleedingPoint);
    if (bleeding.otherDescription) {
      bleedingText += ` (${bleeding.otherDescription})`;
    }
    summaries.push(`出血点: ${bleedingText}`);
  }
  
  // 自我评分
  if (metricsData['self-rating']?.selfRating !== undefined) {
    summaries.push(`自我评分: ${metricsData['self-rating'].selfRating}/10分`);
  }
  
  // 尿液检测矩阵
  if (metricsData['urinalysis-matrix']?.urinalysisMatrix) {
    const matrix = metricsData['urinalysis-matrix'].urinalysisMatrix;
    if (matrix.length > 0) {
      summaries.push(`尿液检测: ${matrix.length}项指标`);
    }
  }
  
  return summaries.length > 0 ? summaries.join(' | ') : '健康指标记录';
}

/**
 * parseDietSummary — 解析饮食记录摘要
 */
function parseDietSummary(content) {
  const dietData = content.dietData || {};
  const summaries = [];
  
  // 统计餐次数量
  const mealCount = Object.keys(dietData).length;
  if (mealCount > 0) {
    summaries.push(`${mealCount}餐记录`);
  }
  
  // 获取第一餐的时间作为参考
  const firstMeal = Object.values(dietData)[0];
  if (firstMeal && firstMeal.time) {
    summaries.push(`时间: ${firstMeal.time}`);
  }
  
  // 获取第一餐的食物内容（截取前20个字符）
  if (firstMeal && firstMeal.food) {
    const foodPreview = firstMeal.food.length > 20 
      ? firstMeal.food.substring(0, 20) + '...' 
      : firstMeal.food;
    summaries.push(`内容: ${foodPreview}`);
  }
  
  return summaries.length > 0 ? summaries.join(' | ') : '饮食记录';
}

/**
 * parseCaseSummary — 解析病例记录摘要
 */
function parseCaseSummary(content) {
  const caseData = content.caseData || {};
  const summaries = [];
  
  // 医院信息
  if (caseData.hospital) {
    summaries.push(`医院: ${caseData.hospital}`);
  }
  
  // 科室信息
  if (caseData.department) {
    summaries.push(`科室: ${caseData.department}`);
  }
  
  // 医生信息
  if (caseData.doctor) {
    summaries.push(`医生: ${caseData.doctor}`);
  }
  
  // 诊断信息（截取前30个字符）
  if (caseData.diagnosis) {
    const diagnosisPreview = caseData.diagnosis.length > 30 
      ? caseData.diagnosis.substring(0, 30) + '...' 
      : caseData.diagnosis;
    summaries.push(`诊断: ${diagnosisPreview}`);
  }
  
  // 图片数量
  if (caseData.images && caseData.images.length > 0) {
    summaries.push(`图片: ${caseData.images.length}张`);
  }
  
  return summaries.length > 0 ? summaries.join(' | ') : '病例记录';
}

/**
 * getBleedingPointText — 获取出血点中文描述
 */
function getBleedingPointText(bleedingPoint) {
  const bleedingMap = {
    'joints': '关节',
    'thigh': '大腿',
    'calf': '小腿',
    'upper-arm': '大臂',
    'forearm': '小臂',
    'abdomen': '腹部',
    'other': '其他',
    // 保留旧格式的兼容性
    'nose': '鼻子',
    'gums': '牙龈',
    'skin': '皮肤',
    'muscles': '肌肉',
    'urine': '尿液',
    'stool': '大便',
    'vomit': '呕吐物',
    'menstrual': '月经'
  };
  return bleedingMap[bleedingPoint] || bleedingPoint;
}

/**
 * getUrinalysisItemText — 获取尿常规检测项目中文描述
 */
function getUrinalysisItemText(itemName, customName = null) {
  // 如果是自定义项目，返回自定义名称
  if (itemName === 'custom' && customName) {
    return customName;
  }
  
  const urinalysisMap = {
    // 基本项目
    'color': '颜色',
    'appearance': '外观',
    'clarity': '透明度',
    'specific_gravity': '比重',
    'ph': 'pH值',
    'protein': '蛋白质',
    'glucose': '葡萄糖',
    'ketones': '酮体',
    'blood': '隐血',
    'nitrite': '亚硝酸盐',
    'leukocyte_esterase': '白细胞酯酶',
    'bilirubin': '胆红素',
    'urobilinogen': '尿胆原',
    
    // 显微镜检查
    'rbc': '红细胞',
    'wbc': '白细胞',
    'epithelial_cells': '上皮细胞',
    'casts': '管型',
    'crystals': '结晶',
    'bacteria': '细菌',
    'yeast': '酵母菌',
    'parasites': '寄生虫',
    'mucus': '粘液',
    
    // 其他项目
    'albumin': '白蛋白',
    'creatinine': '肌酐',
    'microalbumin': '微量白蛋白',
    'protein_creatinine_ratio': '蛋白肌酐比',
    'albumin_creatinine_ratio': '白蛋白肌酐比',
    
    // 常见英文缩写
    'sg': '比重',
    'le': '白细胞酯酶',
    'nit': '亚硝酸盐',
    'bld': '隐血',
    'pro': '蛋白质',
    'glu': '葡萄糖',
    'ket': '酮体',
    'bil': '胆红素',
    'ubg': '尿胆原',
    
    // 其他可能的项目
    'other': '其他',
    'unknown': '未知'
  };
  
  // 转换为小写进行匹配
  const lowerItemName = itemName.toLowerCase();
  return urinalysisMap[lowerItemName] || itemName;
}

/**
 * getBloodTestItemText — 获取血常规检测项目的中文名称
 */
function getBloodTestItemText(item, customName = null) {
  // 如果是自定义项目，返回自定义名称
  if (item === 'custom' && customName) {
    return customName;
  }
  
  const itemMap = {
    // 白细胞相关
    'wbc-count': '白细胞计数',
    'neutrophils-abs': '中性粒细胞(绝对值)',
    'lymphocytes-abs': '淋巴细胞(绝对值)',
    'monocytes-abs': '单核细胞(绝对值)',
    'eosinophils-abs': '嗜酸性粒细胞(绝对值)',
    'basophils-abs': '嗜碱性粒细胞(绝对值)',
    'neutrophils-percent': '中性粒细胞(百分比)',
    'lymphocytes-percent': '淋巴细胞(百分比)',
    'monocytes-percent': '单核细胞(百分比)',
    'eosinophils-percent': '嗜酸性粒细胞(百分比)',
    'basophils-percent': '嗜碱性粒细胞(百分比)',
    // 红细胞相关
    'rbc-count': '红细胞计数',
    'hemoglobin': '血红蛋白',
    'hematocrit': '红细胞压积',
    'mcv': '平均红细胞体积',
    'mch': '平均红细胞血红蛋白量',
    'mchc': '平均红细胞血红蛋白浓度',
    'rdw-sd': '红细胞分布宽度(SD)',
    'rdw-cv': '红细胞分布宽度(CV)',
    // 血小板相关
    'platelet-count': '血小板计数',
    'pdw': '血小板分布宽度',
    'mpv': '平均血小板体积',
    'pct': '血小板压积',
    'p-lcr': '大型血小板比率'
  };
  return itemMap[item] || item;
}

/**
 * renderDetailContent — 渲染详情内容
 */
function renderDetailContent(data, container) {
  const content = data.content || {};
  const exportInfo = content.exportInfo || {};
  const dataType = data.dataType || 'unknown';
  
  // 检测深色模式
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // 根据深色模式选择样式
  const infoCardStyle = isDarkMode
    ? "margin-bottom: 32px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); position: relative; overflow: hidden;"
    : "margin-bottom: 32px; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); border-radius: 16px; padding: 24px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); position: relative; overflow: hidden;";
    
  const infoItemStyle = isDarkMode
    ? "display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); position: relative;"
    : "display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.06); position: relative;";
    
  const labelStyle = isDarkMode
    ? "font-weight: 700; color: #e2e8f0; font-size: 0.95rem; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; min-width: 100px;"
    : "font-weight: 700; color: #1e293b; font-size: 0.95rem; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; min-width: 100px;";
    
  const valueStyle = isDarkMode
    ? "color: #cbd5e1; font-size: 0.9rem; font-weight: 500; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-align: right;"
    : "color: #475569; font-size: 0.9rem; font-weight: 500; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-align: right;";
    
  const contentStyle = isDarkMode
    ? "color: #f1f5f9;"
    : "color: #1e293b;";
    
  const titleStyle = isDarkMode
    ? "margin: 0 0 24px 0; color: #f1f5f9; font-size: 1.3rem; font-weight: 700; text-align: center; position: relative; padding-bottom: 12px;"
    : "margin: 0 0 24px 0; color: #1e293b; font-size: 1.3rem; font-weight: 700; text-align: center; position: relative; padding-bottom: 12px;";
  
  container.innerHTML = `
    <div style="${infoCardStyle}">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #667eea, #764ba2, #f093fb);"></div>
      <div style="${infoItemStyle}">
        <label style="${labelStyle}">● 记录类型:</label>
        <span style="${valueStyle}">${getTypeTitle(dataType)}</span>
      </div>
      <div style="${infoItemStyle.replace('border-bottom: 1px solid rgba(255, 255, 255, 0.1);', 'border-bottom: none;').replace('border-bottom: 1px solid rgba(0, 0, 0, 0.06);', 'border-bottom: none;')}">
        <label style="${labelStyle}">● 时间:</label>
        <span style="${valueStyle}">${formatDate(exportInfo.exportTime || data.created_at)}</span>
      </div>
      </div>
    <div style="${contentStyle}">
      <h4 style="${titleStyle}">
        详细内容:
        <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 60px; height: 3px; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 2px;"></div>
      </h4>
      <div style="${contentStyle}">
        ${formatContentForDisplay(content, dataType, isDarkMode)}
      </div>
    </div>
  `;
}

/**
 * formatContentForDisplay — 格式化内容用于显示
 */
function formatContentForDisplay(content, dataType, isDarkMode = false) {
  console.log('formatContentForDisplay 调用参数:', { content, dataType, isDarkMode });
  
  const metricsData = content.metricsData || {};
  
  switch (dataType) {
    case 'metrics':
      const result = formatMetricsForDisplay(metricsData, isDarkMode);
      console.log('formatMetricsForDisplay 结果:', result);
      return result;
    case 'diet':
      return formatDietForDisplay(content, isDarkMode);
    case 'case':
      return formatCaseForDisplay(content, isDarkMode);
    default:
      console.log('未知数据类型:', dataType);
      return '<p>暂无详细内容</p>';
  }
}

/**
 * formatMetricsForDisplay — 格式化健康指标用于显示
 */
function formatMetricsForDisplay(metricsData, isDarkMode = false) {
  console.log('formatMetricsForDisplay 调用参数:', metricsData);
  
  let html = '<div style="display: flex; flex-direction: column; gap: 20px;">';
  let hasContent = false;
  
  // 根据深色模式选择样式
  const sectionStyle = isDarkMode
    ? "background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); position: relative; overflow: hidden; transition: all 0.3s ease;"
    : "background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 16px; padding: 24px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); position: relative; overflow: hidden; transition: all 0.3s ease;";
    
  const titleStyle = isDarkMode
    ? "margin: 0 0 16px 0; color: #f1f5f9; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em;"
    : "margin: 0 0 16px 0; color: #1e293b; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em;";
    
  const textStyle = isDarkMode
    ? "margin: 0; color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; font-weight: 500;"
    : "margin: 0; color: #475569; font-size: 0.95rem; line-height: 1.6; font-weight: 500;";
    
  const gridItemStyle = isDarkMode
    ? "display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); transition: all 0.2s ease;"
    : "display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); transition: all 0.2s ease;";
    
  const gridLabelStyle = isDarkMode
    ? "color: #94a3b8; font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em;"
    : "color: #64748b; font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em;";
    
  const gridValueStyle = isDarkMode
    ? "color: #f1f5f9; font-weight: 700; font-size: 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
    : "color: #1e293b; font-weight: 700; font-size: 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;";

  // 症状
  if (metricsData.symptoms?.symptoms) {
    html += `
      <div style="${sectionStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
        <h5 style="${titleStyle}">▶ 症状描述</h5>
        <p style="${textStyle}">${metricsData.symptoms.symptoms}</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 体温
  if (metricsData.temperature?.temperature) {
    html += `
      <div style="${sectionStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
        <h5 style="${titleStyle}">▶ 体温</h5>
        <p style="${textStyle}">${metricsData.temperature.temperature}°C</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 尿常规
  if (metricsData.urinalysis) {
    const urinalysis = metricsData.urinalysis;
    const hasUrinalysisData = urinalysis.protein || urinalysis.glucose || urinalysis.ketones || urinalysis.blood;
    if (hasUrinalysisData) {
      html += `
        <div style="${sectionStyle}">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
          <h5 style="${titleStyle}">▶ 尿常规检查</h5>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 8px;">
            ${urinalysis.protein ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">蛋白质:</span><span style="${gridValueStyle}">${urinalysis.protein}</span></div>` : ''}
            ${urinalysis.glucose ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">葡萄糖:</span><span style="${gridValueStyle}">${urinalysis.glucose}</span></div>` : ''}
            ${urinalysis.ketones ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">酮体:</span><span style="${gridValueStyle}">${urinalysis.ketones}</span></div>` : ''}
            ${urinalysis.blood ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">隐血:</span><span style="${gridValueStyle}">${urinalysis.blood}</span></div>` : ''}
          </div>
        </div>
      `;
      hasContent = true;
    }
  }
  
  // 24h尿蛋白
  if (metricsData.proteinuria?.proteinuria24h) {
    html += `
      <div style="${sectionStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
        <h5 style="${titleStyle}">▶ 24小时尿蛋白</h5>
        <p style="${textStyle}">${metricsData.proteinuria.proteinuria24h}g/24h</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 血常规（旧格式）
  if (metricsData['blood-test']) {
    const blood = metricsData['blood-test'];
    const hasBloodData = blood.wbc || blood.rbc || blood.hb || blood.plt;
    if (hasBloodData) {
      html += `
        <div style="${sectionStyle}">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
          <h5 style="${titleStyle}">▶ 血常规检查</h5>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 8px;">
            ${blood.wbc ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">白细胞:</span><span style="${gridValueStyle}">${blood.wbc}×10⁹/L</span></div>` : ''}
            ${blood.rbc ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">红细胞:</span><span style="${gridValueStyle}">${blood.rbc}×10¹²/L</span></div>` : ''}
            ${blood.hb ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">血红蛋白:</span><span style="${gridValueStyle}">${blood.hb}g/L</span></div>` : ''}
            ${blood.plt ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">血小板:</span><span style="${gridValueStyle}">${blood.plt}×10⁹/L</span></div>` : ''}
          </div>
        </div>
      `;
      hasContent = true;
    }
  }
  
  // 血常规检测矩阵（新格式）
  if (metricsData['blood-test-matrix']?.bloodTestMatrix) {
    const matrix = metricsData['blood-test-matrix'].bloodTestMatrix;
    if (matrix.length > 0) {
      const matrixItemStyle = isDarkMode
        ? "display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); transition: all 0.2s ease; position: relative; overflow: hidden;"
        : "display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); transition: all 0.2s ease; position: relative; overflow: hidden;";
        
      const matrixLabelStyle = isDarkMode
        ? "color: #94a3b8; font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em;"
        : "color: #64748b; font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em;";
        
      const matrixValueStyle = isDarkMode
        ? "color: #f1f5f9; font-weight: 700; font-size: 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
        : "color: #1e293b; font-weight: 700; font-size: 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;";
        
      html += `
        <div style="${sectionStyle}">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
          <h5 style="${titleStyle}">▶ 血常规检测指标</h5>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 8px;">
            ${matrix.map(item => `
              <div style="${matrixItemStyle}">
                <div style="position: absolute; top: 0; left: 0; width: 3px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
                <span style="${matrixLabelStyle}">${getBloodTestItemText(item.item, item.customName)}</span>
                <span style="${matrixValueStyle}">${item.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      hasContent = true;
    }
  }
  
  // 出血点
  if (metricsData['bleeding-point']) {
    const bleeding = metricsData['bleeding-point'];
    
    // 处理出血点数据（支持新的数组格式）
    let bleedingPoints = [];
    if (bleeding.bleedingPoints && Array.isArray(bleeding.bleedingPoints)) {
      // 新格式：数组
      bleedingPoints = bleeding.bleedingPoints;
    } else if (bleeding.bleedingPoint) {
      // 旧格式：单个出血点
      bleedingPoints = [bleeding];
    }
    
    if (bleedingPoints.length > 0) {
      const bleedingTexts = bleedingPoints.map(point => {
        let text = getBleedingPointText(point.bleedingPoint);
        if (point.otherDescription) {
          text += ` (${point.otherDescription})`;
        }
        return text;
      });
      
      html += `
        <div style="${sectionStyle}">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
          <h5 style="${titleStyle}">▶ 出血点 (${bleedingPoints.length}个)</h5>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
            ${bleedingTexts.map(text => `<p style="${textStyle}">• ${text}</p>`).join('')}
          </div>
        </div>
      `;
      hasContent = true;
    }
    
    // 出血点图片展示
    if (bleeding.bleedingImages && bleeding.bleedingImages.length > 0) {
      const imageStyle = isDarkMode
        ? "width: 100%; height: 200px; object-fit: cover; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; border: 2px solid rgba(255, 255, 255, 0.1);"
        : "width: 100%; height: 200px; object-fit: cover; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; border: 2px solid rgba(0, 0, 0, 0.1);";
        
      html += `
        <div style="${sectionStyle}">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
          <h5 style="${titleStyle}">▶ 出血点图片 (${bleeding.bleedingImages.length}张)</h5>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 8px;">
            ${bleeding.bleedingImages.map((imageSrc, index) => `
              <div style="position: relative;">
                <img src="${imageSrc}" alt="出血点图片 ${index + 1}" style="${imageStyle}" onclick="openImageModal('${imageSrc}')" />
                <div style="position: absolute; top: 8px; right: 8px; background: rgba(0, 0, 0, 0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${index + 1}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      hasContent = true;
    }
  }
  
  // 自我评分
  if (metricsData['self-rating']?.selfRating !== undefined) {
    html += `
      <div style="${sectionStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
        <h5 style="${titleStyle}">▶ 自我评分</h5>
        <p style="${textStyle}">${metricsData['self-rating'].selfRating}/10分</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 尿液检测矩阵
  if (metricsData['urinalysis-matrix']?.urinalysisMatrix) {
    const matrix = metricsData['urinalysis-matrix'].urinalysisMatrix;
    if (matrix.length > 0) {
      const matrixItemStyle = isDarkMode
        ? "display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); transition: all 0.2s ease; position: relative; overflow: hidden;"
        : "display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); transition: all 0.2s ease; position: relative; overflow: hidden;";
        
      const matrixLabelStyle = isDarkMode
        ? "color: #94a3b8; font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em;"
        : "color: #64748b; font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em;";
        
      const matrixValueStyle = isDarkMode
        ? "color: #f1f5f9; font-weight: 700; font-size: 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
        : "color: #1e293b; font-weight: 700; font-size: 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;";
        
      html += `
        <div style="${sectionStyle}">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
          <h5 style="${titleStyle}">▶ 尿液检测指标</h5>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 8px;">
            ${matrix.map(item => `
              <div style="${matrixItemStyle}">
                <div style="position: absolute; top: 0; left: 0; width: 3px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
                <span style="${matrixLabelStyle}">${getUrinalysisItemText(item.item, item.customName)}</span>
                <span style="${matrixValueStyle}">${item.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      hasContent = true;
    }
  }
  
  // 如果没有找到任何内容，显示原始数据
  if (!hasContent) {
    const preStyle = isDarkMode
      ? "background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; font-size: 0.85rem; color: #e2e8f0; white-space: pre-wrap; overflow-x: auto;"
      : "background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; font-size: 0.85rem; color: #495057; white-space: pre-wrap; overflow-x: auto;";
      
    html += `
      <div style="${sectionStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
        <h5 style="${titleStyle}">▶ 原始数据</h5>
        <pre style="${preStyle}">${JSON.stringify(metricsData, null, 2)}</pre>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

/**
 * formatDietForDisplay — 格式化饮食记录用于显示
 */
function formatDietForDisplay(content, isDarkMode = false) {
  const dietData = content.dietData || {};
  const meals = Object.values(dietData);
  
  if (meals.length === 0) {
    return '<p>暂无饮食记录</p>';
  }
  
  // 根据深色模式选择样式
  const mealCardStyle = isDarkMode
    ? "background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 12px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); position: relative; overflow: hidden; transition: all 0.3s ease;"
    : "background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; padding: 20px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); position: relative; overflow: hidden; transition: all 0.3s ease;";
    
  const titleStyle = isDarkMode
    ? "margin: 0 0 12px 0; color: #f1f5f9; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;"
    : "margin: 0 0 12px 0; color: #1e293b; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;";
    
  const contentStyle = isDarkMode
    ? "color: #cbd5e1;"
    : "color: #475569;";
    
  const timeStyle = isDarkMode
    ? "margin: 0 0 8px 0; color: #cbd5e1; font-size: 0.9rem; line-height: 1.5;"
    : "margin: 0 0 8px 0; color: #475569; font-size: 0.9rem; line-height: 1.5;";
    
  const foodStyle = isDarkMode
    ? "margin: 0 0 8px 0; color: #cbd5e1; font-size: 0.9rem; line-height: 1.5;"
    : "margin: 0 0 8px 0; color: #475569; font-size: 0.9rem; line-height: 1.5;";
  
  let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
  
  // 按时间排序
  const sortedMeals = meals.sort((a, b) => {
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    return 0;
  });
  
  sortedMeals.forEach((meal, index) => {
    html += `
      <div style="${mealCardStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 3px; height: 100%; background: linear-gradient(180deg, #10b981, #059669);"></div>
        <h5 style="${titleStyle}">
          🍽️ 第${index + 1}餐
        </h5>
        <div style="${contentStyle}">
          ${meal.time ? `<p style="${timeStyle}"><strong>时间:</strong> ${meal.time}</p>` : ''}
          ${meal.food ? `<p style="${foodStyle}"><strong>食物:</strong> ${meal.food}</p>` : ''}
          ${Array.isArray(meal.images) && meal.images.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 8px;">
              ${meal.images.map((src, i) => `
                <div style=\"position: relative;\"> 
                  <img src=\"${src}\" alt=\"饮食图片 ${i+1}\" style=\"width: 100%; height: 140px; object-fit: cover; border-radius: 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.08);\" onclick=\"openImageModal('${src}')\" />
                  <div style=\"position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.55); color: #fff; padding: 2px 6px; border-radius: 6px; font-size: 12px;\">${i+1}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

/**
 * formatCaseForDisplay — 格式化病例记录用于显示
 */
function formatCaseForDisplay(content, isDarkMode = false) {
  return '<p>病例记录详细内容</p>';
}

/**
 * renderAllItemsContent — 渲染全部项目内容
 */
function renderAllItemsContent(items, type, container) {
  if (items.length === 0) {
    container.innerHTML = '<p>暂无数据</p>';
    return;
  }

  const itemsHtml = items.map(item => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); margin-bottom: 12px; transition: all 0.2s ease; cursor: pointer;" data-file-id="${item.id}" data-type="${type}">
      <div style="flex: 1;">
        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 1.1rem; font-weight: 700;">${formatFileName(item.file_name)}</h4>
        <p style="margin: 0; color: #64748b; font-size: 0.9rem;">${formatDate(item.created_at)}</p>
      </div>
      <div style="flex: 1; text-align: right; color: #64748b; font-size: 0.85rem; font-family: 'Courier New', monospace; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${item.preview ? JSON.stringify(item.preview, null, 1).substring(0, 100) + '...' : '无预览'}
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${itemsHtml}
    </div>
  `;

  // 绑定点击事件
  container.querySelectorAll('div[data-file-id]').forEach(item => {
    item.addEventListener('click', () => {
      const fileId = item.dataset.fileId;
      const type = item.dataset.type;
      // 关闭当前弹窗
      item.closest('.all-items-modal').remove();
      // 打开详情弹窗
      showDetailModal(fileId, type);
    });
  });
}

// 工具函数
function getTypeIcon(type) {
  const icons = {
    metrics: '📊',
    diet: '🍎',
    case: '📋'
  };
  return icons[type] || '📄';
}

function getTypeTitle(type) {
  const titles = {
    metrics: '健康指标',
    diet: '饮食记录',
    case: '病例记录'
  };
  return titles[type] || '数据记录';
}

function formatFileName(fileName) {
  if (!fileName) return '未知文件';
  // 移除时间戳后缀，只保留主要部分
  return fileName.replace(/_\d{8}T\d{6}Z\.json$/, '');
}

function formatDate(dateString) {
  if (!dateString) return '未知时间';
  
  console.log('formatDate 输入参数:', dateString, '类型:', typeof dateString);
  
  // 如果已经是北京时间格式的字符串（如 "2024/01/15 16:30:45" 或 "2025/09/21 12:49:43"），直接返回
  if (typeof dateString === 'string' && /^\d{4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{1,2}:\d{1,2}$/.test(dateString)) {
    console.log('匹配北京时间格式，直接返回:', dateString);
    return dateString;
  }
  
  // 处理数据库中的时间格式
  let date;
  
  // 如果是MySQL TIMESTAMP格式（如 "2024-01-15 08:30:45"），需要添加'Z'表示UTC时间
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
    console.log('匹配MySQL时间戳格式，添加Z:', dateString + 'Z');
    date = new Date(dateString + 'Z'); // 添加Z表示UTC时间
  } else {
    console.log('其他格式，直接解析:', dateString);
    date = new Date(dateString);
  }
  
  console.log('解析后的日期对象:', date);
  
  // 检查日期是否有效
  if (isNaN(date.getTime())) {
    console.log('无效日期');
    return '无效时间';
  }
  
  const result = date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  console.log('最终结果:', result);
  return result;
}

/**
 * destroyDaily — Tear down listeners and observers for a clean unmount.
 * 清理监听与观察者，便于无痕卸载。
 */
/**
 * formatCaseForDisplay — 格式化病例记录用于显示
 */
function formatCaseForDisplay(content, isDarkMode = false) {
  const caseData = content.caseData || {};
  
  if (!caseData.hospital && !caseData.department && !caseData.doctor && !caseData.diagnosis && !caseData.prescription) {
    return '<p>暂无病例记录</p>';
  }
  
  // 根据深色模式选择样式
  const sectionStyle = isDarkMode
    ? "background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); position: relative; overflow: hidden; transition: all 0.3s ease; margin-bottom: 20px;"
    : "background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 16px; padding: 24px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); position: relative; overflow: hidden; transition: all 0.3s ease; margin-bottom: 20px;";
    
  const titleStyle = isDarkMode
    ? "margin: 0 0 16px 0; color: #f1f5f9; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em;"
    : "margin: 0 0 16px 0; color: #1e293b; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em;";
    
  const textStyle = isDarkMode
    ? "margin: 0; color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; font-weight: 500;"
    : "margin: 0; color: #475569; font-size: 0.95rem; line-height: 1.6; font-weight: 500;";
    
  const gridItemStyle = isDarkMode
    ? "display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); transition: all 0.2s ease;"
    : "display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; border: 1px solid rgba(0, 0, 0, 0.05); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); transition: all 0.2s ease;";
    
  const gridLabelStyle = isDarkMode
    ? "color: #94a3b8; font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em;"
    : "color: #64748b; font-weight: 600; font-size: 0.9rem; letter-spacing: -0.01em;";
    
  const gridValueStyle = isDarkMode
    ? "color: #f1f5f9; font-weight: 700; font-size: 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
    : "color: #1e293b; font-weight: 700; font-size: 0.95rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;";
    
  const imageStyle = isDarkMode
    ? "max-width: 100%; height: auto; border-radius: 12px; border: 2px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); margin: 8px 0; cursor: pointer; transition: all 0.3s ease;"
    : "max-width: 100%; height: auto; border-radius: 12px; border: 2px solid rgba(0, 0, 0, 0.1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); margin: 8px 0; cursor: pointer; transition: all 0.3s ease;";
  
  let html = '<div style="display: flex; flex-direction: column; gap: 20px;">';
  
  // 基本信息
  html += `
    <div style="${sectionStyle}">
      <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
      <h5 style="${titleStyle}">▶ 基本信息</h5>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-top: 8px;">
        ${caseData.hospital ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">医院:</span><span style="${gridValueStyle}">${caseData.hospital}</span></div>` : ''}
        ${caseData.department ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">科室:</span><span style="${gridValueStyle}">${caseData.department}</span></div>` : ''}
        ${caseData.doctor ? `<div style="${gridItemStyle}"><span style="${gridLabelStyle}">医生:</span><span style="${gridValueStyle}">${caseData.doctor}</span></div>` : ''}
      </div>
    </div>
  `;
  
  // 诊断信息
  if (caseData.diagnosis) {
    html += `
      <div style="${sectionStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
        <h5 style="${titleStyle}">▶ 诊断结果</h5>
        <p style="${textStyle}">${caseData.diagnosis}</p>
      </div>
    `;
  }
  
  // 医嘱信息
  if (caseData.prescription) {
    html += `
      <div style="${sectionStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
        <h5 style="${titleStyle}">▶ 医嘱</h5>
        <p style="${textStyle}">${caseData.prescription}</p>
      </div>
    `;
  }
  
  // 图片展示
  if (caseData.images && caseData.images.length > 0) {
    html += `
      <div style="${sectionStyle}">
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
        <h5 style="${titleStyle}">▶ 病例单图片 (${caseData.images.length}张)</h5>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 8px;">
          ${caseData.images.map((imageSrc, index) => `
            <div style="position: relative;">
              <img src="${imageSrc}" alt="病例单图片 ${index + 1}" style="${imageStyle}" onclick="openImageModal('${imageSrc}')" />
              <div style="position: absolute; top: 8px; right: 8px; background: rgba(0, 0, 0, 0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${index + 1}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

/**
 * openImageModal — 打开图片查看模态框
 */
function openImageModal(imageSrc) {
  // 检测深色模式
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // 创建图片查看弹窗
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 20px !important;
    box-sizing: border-box !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
  `;
  
  const backdropStyle = isDarkMode 
    ? "background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(12px);"
    : "background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(12px);";
  
  modal.innerHTML = `
    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; ${backdropStyle}"></div>
    <div style="position: relative; max-width: 90vw; max-height: 90vh; display: flex; align-items: center; justify-content: center;">
      <img src="${imageSrc}" style="max-width: 100%; max-height: 100%; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);" />
      <button style="position: absolute; top: 20px; right: 20px; background: rgba(0, 0, 0, 0.6); border: none; color: white; font-size: 2rem; cursor: pointer; padding: 8px 16px; border-radius: 8px;">&times;</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  
  const closeModal = () => {
    document.body.style.overflow = '';
    modal.remove();
  };
  
  modal.querySelector('button').addEventListener('click', closeModal);
  modal.querySelector('div[style*="backdrop-filter"]').addEventListener('click', closeModal);
}

function destroyDaily() {
  // 中止在途请求
  abortInFlight();

  // 统一执行清理函数
  cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
  cleanupFns = [];

  dailyRoot = document;
  console.log('🧹 destroyDaily 清理完成');
}

// -----------------------------
// Public API / 对外导出
// -----------------------------
window.initDaily = initDaily;
window.destroyDaily = destroyDaily;
window.openImageModal = openImageModal;
})();
