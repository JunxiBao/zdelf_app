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
 * formatDateDisplay — 格式化日期为中文显示
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {string} - 格式化的中文日期 (YYYY年MM月DD日)
 */
function formatDateDisplay(dateString) {
  if (!dateString) return '今天';
  
  const date = new Date(dateString + 'T00:00:00');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${year}年${month}月${day}日`;
}

/**
 * updateDateDisplay — 更新日期显示文本
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 */
function updateDateDisplay(dateString) {
  const dateDisplayText = dailyRoot.querySelector('#date-display');
  if (dateDisplayText) {
    dateDisplayText.textContent = formatDateDisplay(dateString);
  }
}


/**
 * showLocalLoadingState — 显示局部加载状态
 * @param {HTMLElement} container - 要显示加载动画的容器
 * @param {string} dataType - 数据类型 (metrics, diet, case)
 * @param {string} message - 加载提示信息
 */
function showLocalLoadingState(container, dataType = '', message = '正在加载数据...') {
  if (!container) return;
  
  const loadingMessages = {
    'metrics': '正在加载健康指标...',
    'diet': '正在加载饮食记录...',
    'case': '正在加载个人病例...'
  };
  
  const loadingMessage = loadingMessages[dataType] || message;
  
  const loadingHtml = `
    <div class="local-loading ${dataType}">
      <div class="local-loading-spinner"></div>
      <div class="local-loading-text">${loadingMessage}</div>
    </div>
  `;
  
  container.innerHTML = loadingHtml;
}

/**
 * hideLocalLoadingState — 隐藏局部加载状态
 * @param {HTMLElement} container - 包含加载动画的容器
 */
function hideLocalLoadingState(container) {
  if (!container) return;
  
  const localLoading = container.querySelector('.local-loading');
  if (localLoading) {
    localLoading.style.opacity = '0';
    setTimeout(() => {
      // 只移除加载动画，不清空整个容器
      if (localLoading.parentNode) {
        localLoading.remove();
      }
    }, 300);
  }
}

/**
 * showSearchLoadingState — 显示搜索加载状态
 */
function showSearchLoadingState() {
  const cardsContainer = dailyRoot.querySelector('#data-cards-container');
  if (!cardsContainer) return;
  
  const searchLoadingHtml = `
    <div class="search-loading">
      <div class="search-loading-spinner"></div>
      <div class="search-loading-text">正在搜索记录...</div>
    </div>
  `;
  
  cardsContainer.innerHTML = searchLoadingHtml;
}

/**
 * hideSearchLoadingState — 隐藏搜索加载状态
 */
function hideSearchLoadingState() {
  const cardsContainer = dailyRoot.querySelector('#data-cards-container');
  if (!cardsContainer) return;
  
  const searchLoading = cardsContainer.querySelector('.search-loading');
  if (searchLoading) {
    searchLoading.style.opacity = '0';
    setTimeout(() => {
      if (searchLoading.parentNode) {
        searchLoading.parentNode.removeChild(searchLoading);
      }
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

  // 初始化日期选择器
  initDatePicker();

  // 初始化日历按钮
  initCalendarButton();

  // 初始化搜索框
  initSearchBox();

  // 初始化数据类型切换器
  initDataTypeSwitcher();

  // 并行加载问候语和数据卡片（移除全局加载动画，保留局部加载）
  Promise.all([
    loadUsername(),
    loadUserDataCards()
  ]);
}

// 缓存数据卡片，避免重复请求
let cachedDataCards = null;
let dataCardsLoadPromise = null;

// 搜索状态管理
let isSearchMode = false;
let searchDataCards = null;

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

  // 搜索输入事件（添加防抖机制）
  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    console.log('🔍 搜索关键字:', searchKeyword);
    
    // 显示或隐藏清除按钮
    if (searchKeyword) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
    
    // 清除之前的定时器
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // 防抖：延迟300ms执行搜索
    searchTimeout = setTimeout(async () => {
      // 显示搜索加载动画
      showSearchLoadingState();
      
      try {
        // 如果有搜索关键字，执行完整搜索流程
        if (searchKeyword.trim()) {
          console.log('🔍 搜索时直接获取三个月内数据...');
          isSearchMode = true;
          
          // 立即显示搜索加载状态，防止显示中间状态
          const cardsContainer = dailyRoot.querySelector('#data-cards-container');
          if (cardsContainer) {
            cardsContainer.innerHTML = `
              <div class="search-loading">
                <div class="search-loading-spinner"></div>
                <div class="search-loading-text">正在搜索记录...</div>
              </div>
            `;
          }
          
          // 设置搜索标志，防止其他函数干扰
          const originalIsSearchMode = isSearchMode;
          
          // 1. 加载搜索数据（不触发其他渲染）
          await loadUserDataCardsForSearch();
          
          // 2. 预过滤数据（在动画期间完成）
          const filteredData = await preFilterSearchData(searchKeyword);
          
          // 3. 直接渲染最终结果，跳过中间状态
          await renderFinalSearchResults(filteredData);
          
          // 确保搜索模式标志正确设置
          isSearchMode = true;
          
        } else {
          // 清除搜索时，恢复正常模式
          if (isSearchMode) {
            console.log('🔄 退出搜索模式，恢复正常数据');
            isSearchMode = false;
            searchDataCards = null;
          }
          await filterAndRenderCards();
        }
      } catch (error) {
        console.error('搜索过程中发生错误:', error);
        // 出错时显示错误状态
        const cardsContainer = dailyRoot.querySelector('#data-cards-container');
        if (cardsContainer) {
          cardsContainer.innerHTML = `
            <div class="no-data-message">
              <h3>搜索过程中发生错误</h3>
              <p>请稍后重试</p>
            </div>
          `;
        }
      } finally {
        // 隐藏搜索加载动画
        hideSearchLoadingState();
      }
    }, 300);
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
    
    // 退出搜索模式
    isSearchMode = false;
    searchDataCards = null;
    
    // 恢复所有隐藏的时间点和内容
    const timelineContainer = dailyRoot.querySelector('.timeline-container');
    if (timelineContainer) {
      const hiddenItems = timelineContainer.querySelectorAll('.timeline-item[style*="display: none"]');
      hiddenItems.forEach(item => {
        item.style.display = '';
        console.log('🔄 恢复隐藏的时间点');
      });
      
      const hiddenContents = timelineContainer.querySelectorAll('.timeline-content[style*="display: none"]');
      hiddenContents.forEach(content => {
        content.style.display = '';
        console.log('🔄 恢复隐藏的内容');
      });
    }
    
    // 重新渲染所有卡片（使用正常数据）
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
      
      // 显示局部加载动画并重新过滤渲染卡片
      const cardsContainer = dailyRoot.querySelector('#data-cards-container');
      if (cardsContainer) {
        showLocalLoadingState(cardsContainer, selectedDataType, '正在切换数据类型...');
      }
      
      // 重新过滤并渲染卡片
      setTimeout(() => {
        if (isSearchMode && searchKeyword.trim()) {
          // 搜索模式下，重新执行搜索
          console.log(`🔍 搜索模式下切换数据类型，重新执行搜索: "${searchKeyword}"`);
          preFilterSearchData(searchKeyword).then(filteredData => {
            renderFinalSearchResults(filteredData);
          });
        } else {
          // 正常模式下，重新过滤渲染
          filterAndRenderCards();
        }
      }, 50); // 短暂延迟让加载动画显示
    });
  });
  
  console.log('✅ 数据类型切换器初始化完成');
}

/**
 * initDatePicker — 初始化日期选择器
 */
function initDatePicker() {
  const datePicker = dailyRoot.querySelector('#date-picker');
  const datePickerDisplay = dailyRoot.querySelector('#date-picker-display');
  const dateDisplayText = dailyRoot.querySelector('#date-display');
  const clearBtn = dailyRoot.querySelector('#clear-date-btn');
  
  if (!datePicker || !datePickerDisplay || !dateDisplayText || !clearBtn) {
    console.warn('⚠️ 未找到日期选择器元素');
    return;
  }

  // 设置默认日期为当前日期（使用本地时区）
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayString = `${year}-${month}-${day}`;
  datePicker.value = todayString;
  selectedDate = todayString;
  
  // 更新日期显示文本
  updateDateDisplay(todayString);
  
  // 隐藏清除按钮（不再显示叉叉）
  clearBtn.classList.add('hidden');

  // 点击显示按钮触发日期选择器
  datePickerDisplay.addEventListener('click', (e) => {
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
    
    // 更新日期显示文本
    updateDateDisplay(selectedDate);
    
    // 保持清除按钮隐藏（不再显示叉叉）
    clearBtn.classList.add('hidden');
    
    // 切换日期时，重新从后端按天拉取数据
    const cardsContainer = dailyRoot.querySelector('#data-cards-container');
    if (cardsContainer) {
      showLocalLoadingState(cardsContainer, selectedDataType, '正在加载新日期数据...');
    }
    
    // 如果当前在搜索模式，退出搜索模式
    if (isSearchMode) {
      console.log('🔄 日期变化时退出搜索模式');
      isSearchMode = false;
      searchDataCards = null;
      searchKeyword = '';
      searchInput.value = '';
      clearBtn.classList.add('hidden');
    }
    
    abortInFlight();
    loadUserDataCards()
      .then(() => {
        filterAndRenderCards();
      });
  });

  // 清除日期按钮事件（重置为当前日期）
  clearBtn.addEventListener('click', () => {
    // 添加震动反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    
    // 重置为当前日期（使用本地时区）
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    selectedDate = todayString;
    datePicker.value = todayString;
    
    // 更新日期显示文本
    updateDateDisplay(todayString);
    
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
  // 在搜索模式下，跳过此函数，因为搜索已经在预过滤中完成
  if (isSearchMode) {
    console.log('🔍 搜索模式下跳过 filterAndRenderCards，避免显示中间状态');
    return;
  }
  
  // 额外检查：如果当前有搜索关键字且正在搜索，也跳过
  const currentSearchKeyword = dailyRoot.querySelector('#search-input')?.value?.trim();
  if (currentSearchKeyword && currentSearchKeyword.length > 0) {
    console.log('🔍 检测到搜索关键字，跳过 filterAndRenderCards，避免显示中间状态');
    return;
  }
  
  // 根据当前模式检查数据源
  const currentDataSource = cachedDataCards;
  if (!currentDataSource) {
    console.warn(`⚠️ 没有缓存的数据卡片`);
    return;
  }

  const cardsContainer = dailyRoot.querySelector('#data-cards-container');
  if (!cardsContainer) {
    console.warn('⚠️ 未找到卡片容器');
    return;
  }

  // 显示局部加载动画
  showLocalLoadingState(cardsContainer, selectedDataType, '正在筛选数据...');

  // 使用 setTimeout 来模拟异步操作，让加载动画有时间显示
  setTimeout(() => {
    // 根据当前模式选择数据源
    let filteredCards = isSearchMode ? searchDataCards : cachedDataCards;
    
    console.log(`📊 当前模式: ${isSearchMode ? '搜索模式' : '正常模式'}`);
    console.log(`📊 数据源: ${filteredCards ? filteredCards.length : 0} 条记录`);

    // 如果选择了日期，进行日期过滤
    if (selectedDate) {
      // 饮食/指标/病例均基于其内容内的记录日期过滤：
      // - 饮食：在 renderDietTimeline 内按每餐的 date/timestamp 过滤
      // - 指标/病例：在 updateTimelineDetails 内按 exportInfo.recordDate 过滤
      // 因此此处不再按 created_at 预过滤，避免漏掉"补录"的数据
    }

    // 如果有搜索关键字，进行搜索过滤
    if (searchKeyword) {
      console.log(`🔍 开始搜索过滤: "${searchKeyword}"`);
      
      // 在搜索模式下，不进行基础搜索过滤，让详细搜索来处理
      // 这样可以避免卡片先显示后消失的问题
      console.log(`🔍 搜索模式：保留所有数据供详细搜索处理`);
      
      console.log(`🔍 按关键字 "${searchKeyword}" 过滤，从 ${filteredCards ? filteredCards.length : 0} 条记录中筛选出 ${filteredCards ? filteredCards.length : 0} 条`);
    }

    // 按数据类型过滤
    if (selectedDataType) {
      filteredCards = filteredCards.filter(item => {
        return item.dataType === selectedDataType;
      });
      
      console.log(`🏷️ 按数据类型 "${selectedDataType}" 过滤，从 ${currentDataSource.length} 条记录中筛选出 ${filteredCards.length} 条`);
    }

    // 隐藏搜索加载状态
    hideSearchLoadingState();
    
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
  }, 100); // 短暂延迟让加载动画显示
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
  
  // 搜索用户名
  if (item.username && item.username.toLowerCase().includes(lowerKeyword)) {
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
  
  // 搜索ID（支持精确匹配）
  if (item.id && item.id.toString().includes(lowerKeyword)) {
    return true;
  }
  
    // 搜索内容摘要（如果有的话）
    if (item.content) {
      // 排除 appName 字段，避免不相关的匹配
      const filteredContent = { ...item.content };
      if (filteredContent.appName) {
        delete filteredContent.appName;
      }
      const contentStr = JSON.stringify(filteredContent).toLowerCase();
      if (contentStr.includes(lowerKeyword)) {
        return true;
      }
    }
    
    // 搜索预览数据（如果有的话）
    if (item.preview) {
      // 排除 appName 字段，避免不相关的匹配
      const filteredPreview = { ...item.preview };
      if (filteredPreview.appName) {
        delete filteredPreview.appName;
      }
      const previewStr = JSON.stringify(filteredPreview).toLowerCase();
      if (previewStr.includes(lowerKeyword)) {
        return true;
      }
    }
  
  return false;
}

/**
 * searchInCardContent — 在卡片详细内容中搜索关键字（深度优化版）
 * @param {Object} content - 卡片详细内容
 * @param {string} dataType - 数据类型
 * @param {string} keyword - 搜索关键字
 * @returns {boolean} - 是否匹配
 */
function searchInCardContent(content, dataType, keyword) {
  if (!keyword) return true;
  
  const lowerKeyword = keyword.toLowerCase();
  console.log(`🔍 在 ${dataType} 内容中搜索 "${lowerKeyword}"`);
  
  console.log(`🔍 开始搜索关键字: "${lowerKeyword}"`);
  
  // 根据数据类型进行精确搜索
  let result = false;
  switch (dataType) {
    case 'metrics':
      result = searchInMetricsContentOptimized(content, lowerKeyword);
      break;
    case 'diet':
      result = searchInDietContentOptimized(content, lowerKeyword);
      break;
    case 'case':
      result = searchInCaseContentOptimized(content, lowerKeyword);
      break;
    default:
      result = false;
  }
  
  if (result) {
    console.log(`✅ ${dataType} 搜索找到匹配: "${lowerKeyword}"`);
    return true;
  }
  
  // 移除模糊搜索，避免误匹配
  
  console.log(`❌ ${dataType} 搜索未找到匹配: "${lowerKeyword}"`);
  return false;
}

/**
 * filterSearchContent — 过滤搜索内容，彻底排除无关字段
 * @param {Object} content - 原始内容对象
 * @returns {Object} - 过滤后的内容对象
 */
function filterSearchContent(content) {
  if (!content || typeof content !== 'object') {
    return content;
  }
  
  // 递归过滤函数
  const filterObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(item => filterObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const filtered = {};
      for (const [key, value] of Object.entries(obj)) {
        // 特殊处理 exportInfo 字段：完全排除，避免 appName 干扰
        if (key === 'exportInfo') {
          continue; // 完全跳过 exportInfo 字段
        }
        
        // 排除其他无关字段
        const excludeFields = [
          'created_at',        // 创建时间
          'updated_at',        // 更新时间
          'id',                // ID字段
          'userId',            // 用户ID
          'user_id',           // 用户ID
          'file_name',         // 文件名
          'sortTime',          // 排序时间
          'dataType'           // 数据类型
        ];
        
        if (excludeFields.includes(key)) {
          continue;
        }
        
        // 递归过滤嵌套对象
        if (value && typeof value === 'object') {
          filtered[key] = filterObject(value);
        } else {
          filtered[key] = value;
        }
      }
      return filtered;
    }
    
    return obj;
  };
  
  return filterObject(content);
}


/**
 * getSymptomTypeText — 将症状类型代码转换为中文文本
 */
function getSymptomTypeText(type) {
  const typeMap = {
    'skin-type': '皮肤型紫癜',
    'joint-type': '关节型紫癜',
    'abdominal-type': '腹型紫癜',
    'renal-type': '肾型紫癜',
    'other': '其他',
    'none': '无'
  };
  // 确保所有症状都显示中文，未知类型显示为"未知症状"
  return typeMap[type] || '未知症状';
}

/**
 * extractUserVisibleContent — 提取用户可见的内容，排除系统字段
 * @param {Object} content - 原始内容
 * @param {string} dataType - 数据类型
 * @returns {Object} - 用户可见的内容
 */
function extractUserVisibleContent(content, dataType) {
  const filtered = { ...content };
  
  // 排除系统字段
  const systemFields = ['appName', 'appVersion', 'deviceInfo', 'systemInfo', 'metadata', 'version', 'id'];
  systemFields.forEach(field => {
    if (filtered[field]) {
      delete filtered[field];
    }
  });
  
  // 根据数据类型进一步过滤
  switch (dataType) {
    case 'metrics':
      // 健康指标：只保留用户关心的数据
      if (filtered.metricsData) {
        const metricsData = { ...filtered.metricsData };
        // 排除技术字段
        const techFields = ['id', 'version', 'createdAt', 'updatedAt', 'appName'];
        techFields.forEach(field => {
          if (metricsData[field]) {
            delete metricsData[field];
          }
        });
        filtered.metricsData = metricsData;
      }
      break;
      
    case 'diet':
      // 饮食记录：只保留用户关心的数据
      if (filtered.dietData) {
        const dietData = { ...filtered.dietData };
        Object.keys(dietData).forEach(mealKey => {
          if (dietData[mealKey] && typeof dietData[mealKey] === 'object') {
            const meal = { ...dietData[mealKey] };
            // 排除技术字段
            const techFields = ['id', 'version', 'createdAt', 'updatedAt', 'appName'];
            techFields.forEach(field => {
              if (meal[field]) {
                delete meal[field];
              }
            });
            dietData[mealKey] = meal;
          }
        });
        filtered.dietData = dietData;
      }
      break;
      
    case 'case':
      // 病例记录：只保留用户关心的数据
      if (filtered.caseInfo) {
        const caseInfo = { ...filtered.caseInfo };
        // 排除技术字段
        const techFields = ['id', 'version', 'createdAt', 'updatedAt', 'appName'];
        techFields.forEach(field => {
          if (caseInfo[field]) {
            delete caseInfo[field];
          }
        });
        filtered.caseInfo = caseInfo;
      }
      break;
  }
  
  return filtered;
}

/**
 * searchInMetricsContentOptimized — 优化的健康指标搜索
 */
function searchInMetricsContentOptimized(content, keyword) {
  const metricsData = content.metricsData || {};
  console.log(`🔍 优化搜索健康指标: "${keyword}"`);
  
  // 增强搜索：支持分词和模糊匹配
  const searchTerms = keyword.split(/\s+/).filter(term => term.length > 0);
  console.log(`🔍 搜索词分解:`, searchTerms);
  
  // 1. 症状搜索（最高优先级）
  if (metricsData.symptoms?.items && Array.isArray(metricsData.symptoms.items)) {
    for (const symptom of metricsData.symptoms.items) {
      // 症状类型匹配
      const symptomTypeText = getSymptomTypeText(symptom.type);
      if (symptomTypeText.toLowerCase().includes(keyword)) {
        console.log(`✅ 症状类型匹配: "${symptomTypeText}"`);
        return true;
      }
      
      // 增强：直接匹配症状类型代码
      if (symptom.type && symptom.type.toLowerCase().includes(keyword)) {
        console.log(`✅ 症状类型代码匹配: "${symptom.type}"`);
        return true;
      }
      // 症状描述匹配
      if (symptom.description && symptom.description.toLowerCase().includes(keyword)) {
        console.log(`✅ 症状描述匹配: "${symptom.description}"`);
        return true;
      }
      // 症状详情匹配
      if (symptom.detail && symptom.detail.toLowerCase().includes(keyword)) {
        console.log(`✅ 症状详情匹配: "${symptom.detail}"`);
        return true;
      }
      
      // 增强：分词匹配
      if (searchTerms.length > 1) {
        const allFields = [symptomTypeText, symptom.description, symptom.detail].filter(Boolean);
        const allFieldsText = allFields.join(' ').toLowerCase();
        const allTermsMatch = searchTerms.every(term => allFieldsText.includes(term));
        if (allTermsMatch) {
          console.log(`✅ 症状分词匹配: "${allFieldsText}"`);
          return true;
        }
      }
    }
  }
  // 兼容旧格式症状
  else if (metricsData.symptoms?.symptoms && metricsData.symptoms.symptoms.toLowerCase().includes(keyword)) {
    console.log(`✅ 旧格式症状匹配: "${metricsData.symptoms.symptoms}"`);
    return true;
  }
  
  // 2. 出血点搜索（高优先级）
  if (metricsData['bleeding-point']?.bleedingPoint) {
    const bleeding = metricsData['bleeding-point'];
    const bleedingText = getBleedingPointText(bleeding.bleedingPoint);
    if (bleedingText.toLowerCase().includes(keyword)) {
      console.log(`✅ 出血点匹配: "${bleedingText}"`);
      return true;
    }
    if (bleeding.otherDescription && bleeding.otherDescription.toLowerCase().includes(keyword)) {
      console.log(`✅ 出血点描述匹配: "${bleeding.otherDescription}"`);
      return true;
    }
  }
  
  // 3. 检测矩阵搜索（中优先级）
  const matrixFields = ['blood-test-matrix', 'urinalysis-matrix'];
  for (const field of matrixFields) {
    if (metricsData[field]?.bloodTestMatrix || metricsData[field]?.urinalysisMatrix) {
      const matrix = metricsData[field].bloodTestMatrix || metricsData[field].urinalysisMatrix;
      for (const item of matrix) {
        if (item.item && item.item.toLowerCase().includes(keyword)) {
          console.log(`✅ 检测项目匹配: "${item.item}"`);
          return true;
        }
        if (item.customName && item.customName.toLowerCase().includes(keyword)) {
          console.log(`✅ 自定义项目匹配: "${item.customName}"`);
          return true;
        }
      }
    }
  }
  
  // 4. 数值搜索（低优先级，只搜索有意义的数值）
  const numericFields = [
    { field: 'temperature', key: 'temperature', label: '体温' },
    { field: 'proteinuria', key: 'proteinuria24h', label: '24h尿蛋白' },
    { field: 'blood-test', key: 'wbc', label: '白细胞' },
    { field: 'blood-test', key: 'rbc', label: '红细胞' },
    { field: 'blood-test', key: 'hb', label: '血红蛋白' },
    { field: 'blood-test', key: 'plt', label: '血小板' }
  ];
  
  for (const { field, key, label } of numericFields) {
    if (metricsData[field]?.[key] !== undefined) {
      const value = metricsData[field][key].toString();
      if (value.toLowerCase().includes(keyword)) {
        console.log(`✅ ${label}匹配: "${value}"`);
        return true;
      }
    }
  }
  
  // 5. 自我评分搜索（特殊处理）
  if (metricsData['self-rating']?.selfRating !== undefined) {
    const selfRating = metricsData['self-rating'].selfRating.toString();
    // 只有当关键字是数字且与评分完全匹配时才返回true
    if (/^\d+$/.test(keyword) && selfRating === keyword) {
      console.log(`✅ 自我评分精确匹配: "${selfRating}"`);
      return true;
    }
  }
  
  // 6. 检查是否有任何实际内容（避免空记录被匹配）
  const hasActualContent = Object.keys(metricsData).some(key => {
    const data = metricsData[key];
    if (typeof data === 'object' && data !== null) {
      // 检查对象是否有非空值
      return Object.values(data).some(value => {
        if (typeof value === 'string') return value.trim().length > 0;
        if (typeof value === 'number') return value !== 0;
        if (Array.isArray(value)) return value.length > 0;
        return value !== null && value !== undefined;
      });
    }
    return false;
  });
  
  if (!hasActualContent) {
    console.log(`⚠️ 健康指标记录没有实际内容，跳过匹配`);
    return false;
  }
  
  return false;
}

/**
 * searchInMetricsContent — 在健康指标内容中搜索（保持向后兼容）
 */
function searchInMetricsContent(content, keyword) {
  return searchInMetricsContentOptimized(content, keyword);
}

/**
 * searchInDietContentOptimized — 优化的饮食搜索
 */
function searchInDietContentOptimized(content, keyword) {
  const dietData = content.dietData || {};
  console.log(`🔍 优化搜索饮食内容: "${keyword}"`);
  console.log(`🍽️ 饮食数据结构:`, dietData);
  
  // 增强搜索：支持分词和模糊匹配
  const searchTerms = keyword.split(/\s+/).filter(term => term.length > 0);
  console.log(`🔍 搜索词分解:`, searchTerms);
  
  // 饮食数据结构：{ "meal_1": { time: "08:00", food: "早餐", mealId: 1, images: [] }, ... }
  for (const [mealKey, meal] of Object.entries(dietData)) {
    if (!meal || typeof meal !== 'object') continue;
    
    console.log(`🔍 检查餐次: ${mealKey}`, meal);
    
    // 完全匹配
    if (meal.food && meal.food.toLowerCase().includes(keyword)) {
      console.log(`✅ 食物匹配: "${meal.food}"`);
      return true;
    }
    
    // 增强：分词匹配
    if (searchTerms.length > 1 && meal.food) {
      const foodText = meal.food.toLowerCase();
      const allTermsMatch = searchTerms.every(term => foodText.includes(term));
      if (allTermsMatch) {
        console.log(`✅ 食物分词匹配: "${meal.food}"`);
        return true;
      }
    }
    
    // 增强：时间搜索
    if (meal.time && meal.time.toLowerCase().includes(keyword)) {
      console.log(`✅ 用餐时间匹配: "${meal.time}"`);
      return true;
    }
  }
  
  console.log(`❌ 饮食搜索未找到匹配: "${keyword}"`);
  return false;
}


/**
 * searchInDietContent — 在饮食记录内容中搜索（保持向后兼容）
 */
function searchInDietContent(content, keyword) {
  return searchInDietContentOptimized(content, keyword);
}


/**
 * searchInCaseContent — 在病例记录内容中搜索
 */
function searchInCaseContent(content, keyword) {
  // 搜索病例基本信息
  if (content.caseInfo) {
    const caseInfo = content.caseInfo;
    
    // 搜索病例标题
    if (caseInfo.title && caseInfo.title.toLowerCase().includes(keyword)) return true;
    
    // 搜索病例描述
    if (caseInfo.description && caseInfo.description.toLowerCase().includes(keyword)) return true;
    
    // 搜索诊断
    if (caseInfo.diagnosis && caseInfo.diagnosis.toLowerCase().includes(keyword)) return true;
    
    // 搜索症状
    if (caseInfo.symptoms && caseInfo.symptoms.toLowerCase().includes(keyword)) return true;
    
    // 搜索治疗方案
    if (caseInfo.treatment && caseInfo.treatment.toLowerCase().includes(keyword)) return true;
    
    // 搜索医生信息
    if (caseInfo.doctor && caseInfo.doctor.toLowerCase().includes(keyword)) return true;
    
    // 搜索医院信息
    if (caseInfo.hospital && caseInfo.hospital.toLowerCase().includes(keyword)) return true;
    
    // 搜索科室
    if (caseInfo.department && caseInfo.department.toLowerCase().includes(keyword)) return true;
    
    // 搜索备注
    if (caseInfo.notes && caseInfo.notes.toLowerCase().includes(keyword)) return true;
  }
  
  // 搜索检查结果
  if (content.examinationResults) {
    const results = content.examinationResults;
    for (const [key, value] of Object.entries(results)) {
      if (key.toLowerCase().includes(keyword)) return true;
      if (value && value.toString().toLowerCase().includes(keyword)) return true;
    }
  }
  
  // 搜索药物信息
  if (content.medications) {
    const medications = content.medications;
    if (Array.isArray(medications)) {
      for (const med of medications) {
        if (med.name && med.name.toLowerCase().includes(keyword)) return true;
        if (med.dosage && med.dosage.toLowerCase().includes(keyword)) return true;
        if (med.frequency && med.frequency.toLowerCase().includes(keyword)) return true;
        if (med.notes && med.notes.toLowerCase().includes(keyword)) return true;
      }
    }
  }
  
  // 搜索时间信息
  if (content.recordTime && content.recordTime.toLowerCase().includes(keyword)) return true;
  if (content.visitDate && content.visitDate.toLowerCase().includes(keyword)) return true;
  
  // 搜索exportInfo
  if (content.exportInfo) {
    const exportInfo = content.exportInfo;
    if (exportInfo.recordTime && exportInfo.recordTime.toLowerCase().includes(keyword)) return true;
    if (exportInfo.exportTime && exportInfo.exportTime.toLowerCase().includes(keyword)) return true;
  }
  
  // 最后进行全文搜索
  const contentStr = JSON.stringify(content).toLowerCase();
  return contentStr.includes(keyword);
}

/**
 * searchInCaseContentOptimized — 优化的病例搜索
 */
function searchInCaseContentOptimized(content, keyword) {
  console.log(`🔍 优化搜索病例内容: "${keyword}"`);
  console.log(`🏥 病例数据结构:`, content);
  
  // 调试：检查是否包含紫癜相关内容
  if (keyword.includes('紫癜') || keyword.includes('紫癜')) {
    console.log(`🔍 搜索紫癜相关关键词，检查数据结构:`);
    console.log(`- caseInfo:`, content.caseInfo);
    console.log(`- 诊断字段:`, content.caseInfo?.diagnosis);
    console.log(`- 症状字段:`, content.caseInfo?.symptoms);
    console.log(`- 完整内容:`, JSON.stringify(content, null, 2));
  }
  
  // 增强搜索：支持分词和模糊匹配
  const searchTerms = keyword.split(/\s+/).filter(term => term.length > 0);
  console.log(`🔍 搜索词分解:`, searchTerms);
  
  // 1. 病例基本信息搜索（高优先级）
  if (content.caseInfo) {
    const caseInfo = content.caseInfo;
    console.log(`🏥 病例信息:`, caseInfo);
    
    // 按重要性排序搜索 - 扩展更多字段
    const importantFields = [
      { field: 'title', label: '标题' },
      { field: 'diagnosis', label: '诊断' },
      { field: 'symptoms', label: '症状' },
      { field: 'treatment', label: '治疗方案' },
      { field: 'description', label: '描述' },
      { field: 'hospital', label: '医院' },
      { field: 'department', label: '科室' },
      { field: 'doctor', label: '医生' },
      { field: 'prescription', label: '医嘱' },
      { field: 'notes', label: '备注' }
    ];
    
    for (const { field, label } of importantFields) {
      if (caseInfo[field] && caseInfo[field].toLowerCase().includes(keyword)) {
        console.log(`✅ 病例${label}匹配: "${caseInfo[field]}"`);
        return true;
      }
      
      // 增强：分词匹配
      if (searchTerms.length > 1 && caseInfo[field]) {
        const fieldText = caseInfo[field].toLowerCase();
        const allTermsMatch = searchTerms.every(term => fieldText.includes(term));
        if (allTermsMatch) {
          console.log(`✅ 病例${label}分词匹配: "${caseInfo[field]}"`);
          return true;
        }
      }
    }
    
    // 医疗信息搜索（中优先级）
    const medicalFields = [
      { field: 'doctor', label: '医生' },
      { field: 'hospital', label: '医院' },
      { field: 'department', label: '科室' },
      { field: 'notes', label: '备注' }
    ];
    
    for (const { field, label } of medicalFields) {
      if (caseInfo[field] && caseInfo[field].toLowerCase().includes(keyword)) {
        console.log(`✅ 病例${label}匹配: "${caseInfo[field]}"`);
        return true;
      }
      
      // 增强：分词匹配
      if (searchTerms.length > 1 && caseInfo[field]) {
        const fieldText = caseInfo[field].toLowerCase();
        const allTermsMatch = searchTerms.every(term => fieldText.includes(term));
        if (allTermsMatch) {
          console.log(`✅ 病例${label}分词匹配: "${caseInfo[field]}"`);
          return true;
        }
      }
    }
  }
  
  // 2. 检查结果搜索（中优先级）
  if (content.examinationResults) {
    const results = content.examinationResults;
    for (const [key, value] of Object.entries(results)) {
      if (key.toLowerCase().includes(keyword)) {
        console.log(`✅ 检查项目匹配: "${key}"`);
        return true;
      }
      if (value && value.toString().toLowerCase().includes(keyword)) {
        console.log(`✅ 检查结果匹配: "${value}"`);
        return true;
      }
    }
  }
  
  // 使用过滤后的内容进行深度搜索，避免 exportInfo 干扰
  const filteredContent = filterSearchContent(content);
  
  // 增强：搜索所有文本内容（包括嵌套对象）
  const searchInNestedContent = (obj, searchTerm) => {
    if (typeof obj === 'string') {
      return obj.toLowerCase().includes(searchTerm);
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.toLowerCase().includes(searchTerm)) {
          console.log(`✅ 嵌套内容匹配: "${key}" = "${value}"`);
          return true;
        }
        if (typeof value === 'object' && searchInNestedContent(value, searchTerm)) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (searchInNestedContent(filteredContent, keyword)) {
    console.log(`✅ 嵌套内容搜索匹配: "${keyword}"`);
    return true;
  }
  
  // 新增：通用深度搜索，确保不遗漏任何内容
  const deepSearchInContent = (obj, searchTerm) => {
    if (typeof obj === 'string') {
      return obj.toLowerCase().includes(searchTerm);
    }
    if (Array.isArray(obj)) {
      return obj.some(item => deepSearchInContent(item, searchTerm));
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => deepSearchInContent(value, searchTerm));
    }
    return false;
  };
  
  if (deepSearchInContent(filteredContent, keyword)) {
    console.log(`✅ 深度搜索匹配: "${keyword}"`);
    return true;
  }
  
  // 3. 用药信息搜索（中优先级）
  if (content.medications && Array.isArray(content.medications)) {
    for (const med of content.medications) {
      if (med.name && med.name.toLowerCase().includes(keyword)) {
        console.log(`✅ 药物名称匹配: "${med.name}"`);
        return true;
      }
      if (med.dosage && med.dosage.toLowerCase().includes(keyword)) {
        console.log(`✅ 药物剂量匹配: "${med.dosage}"`);
        return true;
      }
      if (med.frequency && med.frequency.toLowerCase().includes(keyword)) {
        console.log(`✅ 用药频率匹配: "${med.frequency}"`);
        return true;
      }
      if (med.notes && med.notes.toLowerCase().includes(keyword)) {
        console.log(`✅ 用药备注匹配: "${med.notes}"`);
        return true;
      }
    }
  }
  
  // 4. 时间信息搜索（低优先级）
  const timeFields = ['recordTime', 'visitDate'];
  for (const field of timeFields) {
    if (content[field] && content[field].toLowerCase().includes(keyword)) {
      console.log(`✅ 时间信息匹配: "${content[field]}"`);
      return true;
    }
  }
  
  // 5. 导出信息搜索（低优先级）
  if (content.exportInfo) {
    const exportInfo = content.exportInfo;
    if (exportInfo.recordTime && exportInfo.recordTime.toLowerCase().includes(keyword)) {
      console.log(`✅ 导出记录时间匹配: "${exportInfo.recordTime}"`);
      return true;
    }
    if (exportInfo.exportTime && exportInfo.exportTime.toLowerCase().includes(keyword)) {
      console.log(`✅ 导出时间匹配: "${exportInfo.exportTime}"`);
      return true;
    }
  }
  
  return false;
}

/**
 * preFilterSearchData — 预过滤搜索数据，在动画期间完成所有搜索操作
 * @param {string} keyword - 搜索关键字
 * @returns {Promise<Array>} - 过滤后的数据
 */
async function preFilterSearchData(keyword) {
  console.log(`🔍 预过滤搜索数据: "${keyword}"`);
  console.log(`📊 搜索数据卡片数量: ${searchDataCards ? searchDataCards.length : 0}`);
  
  if (!searchDataCards || searchDataCards.length === 0) {
    console.log('⚠️ 没有搜索数据可过滤');
    return [];
  }
  
  const filteredCards = [];
  
  // 按数据类型过滤
  let dataToFilter = searchDataCards;
  if (selectedDataType) {
    dataToFilter = searchDataCards.filter(item => item.dataType === selectedDataType);
    console.log(`🏷️ 按数据类型 "${selectedDataType}" 过滤，从 ${searchDataCards.length} 条记录中筛选出 ${dataToFilter.length} 条`);
  }
  
  console.log(`🔍 开始处理 ${dataToFilter.length} 条记录进行搜索匹配`);
  
  // 并行处理所有记录，提高搜索速度
  const searchPromises = dataToFilter.map(async (item) => {
    try {
      console.log(`🔍 处理记录: ${item.dataType} - ${item.id}`);
      
      // 获取完整数据
      const response = await fetch(`${__API_BASE__}/getjson/${item.dataType}/${item.id}`);
      const detailData = await response.json();
      
      if (detailData.success) {
        const content = detailData.data.content || {};
        console.log(`📄 获取到内容:`, content);
        
        // 进行搜索匹配
        const matches = searchInCardContent(content, item.dataType, keyword);
        console.log(`🔍 搜索匹配结果: ${matches}`);
        
        if (matches) {
          console.log(`✅ 搜索匹配: ${item.dataType} - ${item.id}`);
          return {
            ...item,
            content: content,
            detailData: detailData.data
          };
        } else {
          console.log(`❌ 搜索不匹配: ${item.dataType} - ${item.id}`);
          return null;
        }
      } else {
        console.warn(`❌ 获取数据失败: ${item.dataType} - ${item.id}`, detailData);
        return null;
      }
    } catch (error) {
      console.warn(`获取 ${item.dataType} 数据失败:`, error);
      return null;
    }
  });
  
  // 等待所有搜索完成
  const searchResults = await Promise.all(searchPromises);
  
  // 过滤掉 null 结果
  const validResults = searchResults.filter(result => result !== null);
  filteredCards.push(...validResults);
  
  console.log(`🔍 预过滤完成，从 ${dataToFilter.length} 条记录中筛选出 ${filteredCards.length} 条匹配记录`);
  return filteredCards;
}

/**
 * renderFinalSearchResults — 渲染最终搜索结果
 * @param {Array} filteredData - 过滤后的数据
 */
async function renderFinalSearchResults(filteredData) {
  console.log(`🎨 渲染最终搜索结果: ${filteredData.length} 条记录`);
  console.log(`📊 过滤后的数据:`, filteredData);
  
  const cardsContainer = dailyRoot.querySelector('#data-cards-container');
  if (!cardsContainer) {
    console.warn('⚠️ 未找到数据卡片容器');
    return;
  }
  
  console.log(`🎯 找到数据卡片容器:`, cardsContainer);
  
  if (filteredData.length === 0) {
    // 显示无搜索结果
    cardsContainer.innerHTML = `
      <div class="no-data-message">
        <h3>未找到匹配的记录</h3>
        <p>请尝试其他关键字或调整搜索条件</p>
      </div>
    `;
    return;
  }
  
  console.log(`🎨 开始渲染 ${filteredData.length} 条搜索结果`);
  
  // 按时间分组 - 显示完整的记录时间（日期+时间）
  const groupedData = {};
  for (const item of filteredData) {
    const time = item.sortTime || item.created_at;
    // 获取完整的记录时间，优先使用 recordTime，回退到 exportTime，最后是 created_at
    const recordTime = item.content?.recordTime || 
                      item.content?.exportInfo?.recordTime || 
                      item.content?.exportInfo?.exportTime || 
                      time;
    
    // 格式化显示：日期 + 时间
    const dateTime = new Date(recordTime);
    const dateStr = dateTime.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    });
    const timeStr = dateTime.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const fullTimeStr = `${dateStr} ${timeStr}`;
    
    if (!groupedData[fullTimeStr]) {
      groupedData[fullTimeStr] = [];
    }
    groupedData[fullTimeStr].push(item);
  }
  
  console.log(`⏰ 时间分组结果:`, groupedData);
  
  // 生成时间线HTML
  const timelineItems = [];
  for (const [time, items] of Object.entries(groupedData)) {
    if (!items || items.length === 0) continue;
    
    console.log(`⏰ 处理时间点: ${time}, 项目数量: ${items.length}`);
    
    const itemHTMLs = items.map(item => {
      return `
        <div class="timeline-content" data-file-id="${item.id}" data-type="${item.dataType}">
          <div class="content-type-badge ${item.dataType}">${getTypeTitle(item.dataType)}</div>
          <div class="content-summary">${getSearchResultSummary(item)}</div>
        </div>
      `;
    });
    
    timelineItems.push(`
      <div class="timeline-item">
        <div class="timeline-node"></div>
        <div class="timeline-time" title="记录时间: ${time}">${time}</div>
        ${itemHTMLs.join('')}
      </div>
    `);
  }
  
  // 创建完整的时间线HTML，包含搜索结果统计
  const timelineHTML = `
    <div class="search-results-header">
      <div class="search-results-count">
        <span class="results-text">找到 ${filteredData.length} 条记录</span>
      </div>
    </div>
    <div class="timeline-container">
      <div class="timeline-line"></div>
      ${timelineItems.join('')}
    </div>
  `;
  
  // 渲染到页面
  console.log(`🎨 准备渲染 ${timelineItems.length} 个时间点`);
  console.log(`📝 时间线HTML:`, timelineHTML);
  
  cardsContainer.innerHTML = timelineHTML;
  
  // 绑定事件
  const timelineContainer = cardsContainer.querySelector('.timeline-container');
  if (timelineContainer) {
    bindUnifiedCardEvents(timelineContainer);
  }
  
  console.log(`✅ 搜索结果渲染完成: ${timelineItems.length} 个时间点`);
}

/**
 * getSearchResultSummary — 获取搜索结果摘要
 * @param {Object} item - 数据项
 * @returns {string} - 摘要HTML
 */
function getSearchResultSummary(item) {
  const { content, dataType } = item;
  
  switch (dataType) {
    case 'metrics':
      return parseMetricsSummary(content.metricsData || {});
    case 'diet':
      return parseDietSummary(content);
    case 'case':
      return parseCaseSummary(content);
    default:
      return '数据摘要';
  }
}

/**
 * loadUserDataCardsForSearch — 专门用于搜索时加载数据（优化版）
 * 智能缓存策略：优先使用缓存，缓存过期时重新加载
 * 注意：此函数不会触发其他渲染，仅更新 searchDataCards
 */
function loadUserDataCardsForSearch() {
  return new Promise((resolve) => {
    const userId = localStorage.getItem('userId') || 
                   localStorage.getItem('UserID') || 
                   sessionStorage.getItem('userId') || 
                   sessionStorage.getItem('UserID');
    
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.warn('⚠️ 未获取到有效 userId，跳过搜索数据加载');
      resolve();
      return;
    }

    // 检查缓存是否有效（1小时内有效）
    const cacheKey = `searchData_${userId}`;
    const cacheTimeKey = `searchDataTime_${userId}`;
    const cachedData = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (cachedData && cacheTime && (now - parseInt(cacheTime)) < oneHour) {
      console.log('🚀 使用缓存的搜索数据');
      try {
        searchDataCards = JSON.parse(cachedData);
        resolve();
        return;
      } catch (e) {
        console.warn('⚠️ 缓存数据解析失败，重新加载');
      }
    }

    // 计算三个月前的时间范围（使用本地时区）
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const year = threeMonthsAgo.getFullYear();
    const month = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');
    const day = String(threeMonthsAgo.getDate()).padStart(2, '0');
    const threeMonthsAgoStr = `${year}-${month}-${day}`;
    
    console.log(`🔍 搜索专用：加载三个月内数据，起始日期: ${threeMonthsAgoStr}`);
    
    // 并行加载所有类型的数据（限制三个月内）
    const dataTypes = ['metrics', 'diet', 'case'];
    const timeRangeParam = `&start_date=${encodeURIComponent(threeMonthsAgoStr)}`;
    
    console.log(`🔗 搜索API请求参数: ${timeRangeParam}`);
    
    const promises = dataTypes.map(type => {
      const url = `${__API_BASE__}/getjson/${type}?user_id=${encodeURIComponent(userId)}&limit=200${timeRangeParam}`;
      console.log(`📡 搜索请求 ${type} 数据: ${url}`);
      return fetch(url)
        .then(res => res.json())
        .then(data => ({ type, data }))
        .catch(err => {
          console.warn(`搜索加载 ${type} 数据失败:`, err);
          return { type, data: { success: false, data: [] } };
        });
    });

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

      console.log(`🔍 搜索获取到 ${baseItems.length} 条基础数据`);

      // 预取每条记录的 exportInfo 以获得排序用的 recordTime
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

      // 按记录时间降序排序
      augmented.sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));

      // 更新搜索数据（独立存储）
      searchDataCards = augmented;
      console.log(`🔍 搜索数据更新：${searchDataCards.length} 条记录`);
      
      // 缓存搜索数据
      try {
        localStorage.setItem(cacheKey, JSON.stringify(augmented));
        localStorage.setItem(cacheTimeKey, now.toString());
        console.log('💾 搜索数据已缓存');
      } catch (e) {
        console.warn('⚠️ 搜索数据缓存失败:', e);
      }
      
      resolve();
    }).catch(err => {
      console.error('搜索数据加载失败:', err);
      cachedDataCards = [];
      resolve();
    });
  });
}

/**
 * loadUserDataCards — 加载并显示用户数据卡片
 * 从后端获取三个月内的用户数据并按时间排序展示
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

    // 显示局部加载动画
    showLocalLoadingState(cardsContainer, selectedDataType, '正在加载数据...');

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
      // 计算三个月前的时间范围（使用本地时区）
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const year = threeMonthsAgo.getFullYear();
      const month = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');
      const day = String(threeMonthsAgo.getDate()).padStart(2, '0');
      const threeMonthsAgoStr = `${year}-${month}-${day}`;
      
      console.log(`📅 加载三个月内数据，起始日期: ${threeMonthsAgoStr}`);
      
      // 并行加载所有类型的数据（限制三个月内，带所选日期筛选，后端做初筛）
      const dataTypes = ['metrics', 'diet', 'case'];
      const dateParam = selectedDate ? `&date=${encodeURIComponent(getDateYMD(String(selectedDate)))}` : '';
      const timeRangeParam = `&start_date=${encodeURIComponent(threeMonthsAgoStr)}`;
      
      console.log(`🔗 API请求参数: ${timeRangeParam}`);
      
      const promises = dataTypes.map(type => {
        const url = `${__API_BASE__}/getjson/${type}?user_id=${encodeURIComponent(userId)}&limit=200${dateParam}${timeRangeParam}`;
        console.log(`📡 请求 ${type} 数据: ${url}`);
        return fetch(url)
          .then(res => res.json())
          .then(data => ({ type, data }))
          .catch(err => {
            console.warn(`加载 ${type} 数据失败:`, err);
            return { type, data: { success: false, data: [] } };
          });
      });

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
    
    // 根据当前选择的数据类型显示不同的无数据提示
    if (selectedDataType === 'metrics') {
      if (selectedDate && searchKeyword) {
        message = `
          <div class="no-data-message">
            <h3>未找到匹配的健康指标</h3>
          </div>
        `;
      } else if (selectedDate) {
        message = `
          <div class="no-data-message">
            <div class="no-data-icon">📊</div>
            <h3>${formatDateDisplay(selectedDate)}无健康记录</h3>
          </div>
        `;
      } else if (searchKeyword) {
        message = `
          <div class="no-data-message">
            <h3>未找到匹配的健康指标</h3>
          </div>
        `;
      } else {
        message = `
          <div class="no-data-message">
            <div class="no-data-icon">📊</div>
            <h3>暂无健康指标记录</h3>
          </div>
        `;
      }
    } else if (selectedDataType === 'case') {
      if (selectedDate && searchKeyword) {
        message = `
          <div class="no-data-message">
            <h3>未找到匹配的病例记录</h3>
          </div>
        `;
      } else if (selectedDate) {
        message = `
          <div class="no-data-message">
            <div class="no-data-icon">📋</div>
            <h3>${formatDateDisplay(selectedDate)}无病例记录</h3>
          </div>
        `;
      } else if (searchKeyword) {
        message = `
          <div class="no-data-message">
            <h3>未找到匹配的病例记录</h3>
          </div>
        `;
      } else {
        message = `
          <div class="no-data-message">
            <div class="no-data-icon">📋</div>
            <h3>暂无病例记录</h3>
          </div>
        `;
      }
    } else if (selectedDataType === 'diet') {
      if (selectedDate && searchKeyword) {
        message = `
          <div class="no-data-message">
            <h3>未找到匹配的饮食记录</h3>
          </div>
        `;
      } else if (selectedDate) {
        message = `
          <div class="no-data-message">
            <div class="no-data-icon">🍽️</div>
            <h3>${formatDateDisplay(selectedDate)}无饮食记录</h3>
          </div>
        `;
      } else if (searchKeyword) {
        message = `
          <div class="no-data-message">
            <h3>未找到匹配的饮食记录</h3>
          </div>
        `;
      } else {
        message = `
          <div class="no-data-message">
            <div class="no-data-icon">🍽️</div>
            <h3>暂无饮食记录</h3>
          </div>
        `;
      }
    } else {
      // 通用的无数据提示（用于搜索所有类型或未指定类型的情况）
      if (selectedDate && searchKeyword) {
        message = `
          <div class="no-data-message">
            <h3>未找到匹配的记录</h3>
          </div>
        `;
      } else if (selectedDate) {
        message = `
          <div class="no-data-message">
            <div class="no-data-icon">📅</div>
            <h3>${formatDateDisplay(selectedDate)}无数据记录</h3>
          </div>
        `;
      } else if (searchKeyword) {
        message = `
          <div class="no-data-message">
            <h3>未找到匹配的记录</h3>
          </div>
        `;
      } else {
        message = `
          <div class="no-data-message">
            <div class="no-data-icon">📝</div>
            <h3>暂无数据记录</h3>
          </div>
        `;
      }
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
    // 根据搜索条件和日期筛选显示不同的无数据提示
    let message;
    if (selectedDate && searchKeyword) {
      message = `
        <div class="no-data-message">
          <h3>未找到匹配的饮食记录</h3>
        </div>
      `;
    } else if (selectedDate) {
      message = `
        <div class="no-data-message">
          <div class="no-data-icon">🍽️</div>
          <h3>${formatDateDisplay(selectedDate)}无饮食记录</h3>
        </div>
      `;
    } else if (searchKeyword) {
      message = `
        <div class="no-data-message">
          <h3>未找到匹配的饮食记录</h3>
        </div>
      `;
    } else {
      message = `
        <div class="no-data-message">
          <div class="no-data-icon">🍽️</div>
          <h3>暂无饮食记录</h3>
        </div>
      `;
    }
    
    container.innerHTML = message;
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
        // 搜索模式下跳过日期过滤
        if (targetDateStr && !searchKeyword) {
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
    // 根据搜索条件和日期筛选显示不同的无数据提示
    let message;
    if (selectedDate && searchKeyword) {
      message = `
        <div class="no-data-message">
          <h3>未找到匹配的饮食记录</h3>
        </div>
      `;
    } else if (selectedDate) {
      message = `
        <div class="no-data-message">
          <div class="no-data-icon">🍽️</div>
          <h3>${formatDateDisplay(selectedDate)}无饮食记录</h3>
        </div>
      `;
    } else if (searchKeyword) {
      message = `
        <div class="no-data-message">
          <h3>未找到匹配的饮食记录</h3>
        </div>
      `;
    } else {
      message = `
        <div class="no-data-message">
          <div class="no-data-icon">🍽️</div>
          <h3>暂无饮食记录</h3>
        </div>
      `;
    }
    
    container.innerHTML = message;
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
                  ${ev.images.map((src, i) => {
                    // 确保图片URL是完整的URL
                    const imageUrl = src.startsWith('http') ? src : (window.__API_BASE__ || 'https://app.zdelf.cn') + src;
                    return `
                    <div style="position: relative;"> 
                      <img src="${imageUrl}" alt="饮食图片 ${i+1}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.08);" onclick="openImageModal('${imageUrl}')" />
                      <div style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.55); color: #fff; padding: 2px 6px; border-radius: 6px; font-size: 12px;">${i+1}</div>
                    </div>
                  `;
                  }).join('')}
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
    // 如果这个时间点没有项目，跳过
    if (!items || items.length === 0) {
      console.log(`⏭️ 跳过空时间点: ${time}`);
      continue;
    }
    
    // 在搜索模式下，显示搜索加载状态
    if (searchKeyword) {
      const itemHTMLs = items.map(item => {
        return `
          <div class="timeline-content" data-file-id="${item.id}" data-type="${item.dataType}">
            <div class="content-type-badge ${item.dataType}">${getTypeTitle(item.dataType)}</div>
            <div class="content-summary">正在搜索匹配内容...</div>
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
    } else {
      // 正常模式下，显示加载状态
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
  }
  
  // 先返回基础HTML，让用户立即看到时间线结构
  const basicHTML = timelineItems.join('');
  
  // 然后异步加载详细信息并更新内容
  setTimeout(async () => {
    try {
      await updateTimelineDetails(groupedData);
    } catch (error) {
      console.error('更新时间线详情失败:', error);
    }
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

          // 指标/病例：按记录日期过滤（搜索模式下跳过日期过滤）
          // - 病例：严格使用 exportInfo.recordTime 的日期部分，缺失则在选中日期时不展示
          // - 指标：使用 exportInfo.recordTime 的日期部分；缺失时回退 exportTime，再回退 created_at
          if (targetDateStr && !searchKeyword && (item.dataType === 'metrics' || item.dataType === 'case')) {
            const exp = detailData.data?.exportInfo || content.exportInfo || {};
            if (item.dataType === 'case') {
              const rt = exp.recordTime;
              if (!rt) { contentElement.style.display = 'none'; continue; }
              const rtDate = getDateYMD(rt);
              if (rtDate !== targetDateStr) { contentElement.style.display = 'none'; continue; }
            } else {
              const primary = exp.recordTime || '';
              const fallback1 = exp.exportTime || '';
              let candidate = primary || fallback1 || item.created_at || '';
              const candidateDate = getDateYMD(candidate);
              if (candidateDate && candidateDate !== targetDateStr) { contentElement.style.display = 'none'; continue; }
            }
          }
          
          // 如果有搜索关键字，检查详细内容是否匹配
          if (searchKeyword) {
            const matches = searchInCardContent(content, item.dataType, searchKeyword);
            if (!matches) {
              // 在搜索模式下，先标记为不匹配，稍后批量隐藏
              contentElement.setAttribute('data-search-match', 'false');
              continue;
            } else {
              contentElement.setAttribute('data-search-match', 'true');
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
    
    // 在搜索模式下，批量隐藏不匹配的卡片
    if (searchKeyword) {
      const nonMatchingContents = targetTimelineItem.querySelectorAll('.timeline-content[data-search-match="false"]');
      nonMatchingContents.forEach(content => {
        content.style.display = 'none';
      });
      console.log(`🔍 隐藏 ${nonMatchingContents.length} 个不匹配的卡片`);
    }
    
    // 清理空的时间点（所有内容都被隐藏的时间点）
    const visibleContents = targetTimelineItem.querySelectorAll('.timeline-content:not([style*="display: none"])');
    if (visibleContents.length === 0) {
      console.log(`🗑️ 清理空时间点: ${time}`);
      targetTimelineItem.style.display = 'none';
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
  
  // 症状（支持新格式）
  if (metricsData.symptoms?.items && Array.isArray(metricsData.symptoms.items)) {
    const symptomTexts = metricsData.symptoms.items.map(symptom => {
      const typeText = getSymptomTypeText(symptom.type);
      let displayText = typeText;
      
      if (symptom.type === 'other' && symptom.description) {
        displayText = `${typeText}(${symptom.description})`;
      }
      
      // 如果有详细信息，添加简短提示
      if (symptom.detail && symptom.detail.trim()) {
        displayText += '*';  // 用星号表示有详细信息
      }
      
      return displayText;
    });
    if (symptomTexts.length > 0) {
      summaries.push(`症状: ${symptomTexts.join('、')}`);
    }
  }
  // 兼容旧格式
  else if (metricsData.symptoms?.symptoms) {
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
  // 确保所有出血点都显示中文，未知部位显示为"未知部位"
  return bleedingMap[bleedingPoint] || '未知部位';
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
  // 确保所有尿常规项目都显示中文，未知项目显示为"未知检测项目"
  return urinalysisMap[lowerItemName] || '未知检测项目';
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
  // 确保所有血常规项目都显示中文，未知项目显示为"未知检测项目"
  return itemMap[item] || '未知检测项目';
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

  // 症状（支持新格式）
  if (metricsData.symptoms?.items && Array.isArray(metricsData.symptoms.items)) {
    const symptomItems = metricsData.symptoms.items.map(symptom => {
      const typeText = getSymptomTypeText(symptom.type);
      let symptomHtml = '';
      
      if (symptom.type === 'other' && symptom.description) {
        symptomHtml = `<span style="display: inline-block; margin: 2px 6px 2px 0; padding: 4px 8px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 12px; font-size: 0.85em;">${typeText}: ${symptom.description}</span>`;
      } else {
        symptomHtml = `<span style="display: inline-block; margin: 2px 6px 2px 0; padding: 4px 8px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 12px; font-size: 0.85em;">${typeText}</span>`;
      }
      
      // 如果有详细信息，添加到症状下方
      if (symptom.detail && symptom.detail.trim()) {
        symptomHtml += `<div style="margin: 6px 0 8px 0; padding: 8px 12px; background: rgba(102, 126, 234, 0.1); border-left: 3px solid #667eea; border-radius: 4px; font-size: 0.9em; color: #4a5568; line-height: 1.4;">详细信息：${symptom.detail}</div>`;
      }
      
      return symptomHtml;
    }).join('');
    
    if (symptomItems) {
      html += `
        <div style="${sectionStyle}">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #667eea, #764ba2);"></div>
          <h5 style="${titleStyle}">▶ 症状记录</h5>
          <div style="${textStyle}">${symptomItems}</div>
        </div>
      `;
      hasContent = true;
    }
  }
  // 兼容旧格式
  else if (metricsData.symptoms?.symptoms) {
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
            ${bleeding.bleedingImages.map((imageSrc, index) => {
              // 确保图片URL是完整的URL
              const imageUrl = imageSrc.startsWith('http') ? imageSrc : (window.__API_BASE__ || 'https://app.zdelf.cn') + imageSrc;
              return `
              <div style="position: relative;">
                <img src="${imageUrl}" alt="出血点图片 ${index + 1}" style="${imageStyle}" onclick="openImageModal('${imageUrl}')" />
                <div style="position: absolute; top: 8px; right: 8px; background: rgba(0, 0, 0, 0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${index + 1}</div>
              </div>
            `;
            }).join('')}
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
              ${meal.images.map((src, i) => {
                // 确保图片URL是完整的URL
                const imageUrl = src.startsWith('http') ? src : (window.__API_BASE__ || 'https://app.zdelf.cn') + src;
                return `
                <div style=\"position: relative;\"> 
                  <img src=\"${imageUrl}\" alt=\"饮食图片 ${i+1}\" style=\"width: 100%; height: 140px; object-fit: cover; border-radius: 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.08);\" onclick=\"openImageModal('${imageUrl}')\" />
                  <div style=\"position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.55); color: #fff; padding: 2px 6px; border-radius: 6px; font-size: 12px;\">${i+1}</div>
                </div>
              `;
              }).join('')}
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
          ${caseData.images.map((imageSrc, index) => {
            // 确保图片URL是完整的URL
            const imageUrl = imageSrc.startsWith('http') ? imageSrc : (window.__API_BASE__ || 'https://app.zdelf.cn') + imageSrc;
            return `
            <div style="position: relative;">
              <img src="${imageUrl}" alt="病例单图片 ${index + 1}" style="${imageStyle}" onclick="openImageModal('${imageUrl}')" />
              <div style="position: absolute; top: 8px; right: 8px; background: rgba(0, 0, 0, 0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${index + 1}</div>
            </div>
          `;
          }).join('')}
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

/**
 * initCalendarButton — 初始化日历按钮
 */
function initCalendarButton() {
  const calendarBtn = dailyRoot.querySelector('#calendar-btn');
  
  if (!calendarBtn) {
    console.warn('⚠️ 未找到日历按钮元素');
    return;
  }

  // 日历按钮点击事件
  calendarBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 添加震动反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
    
    // 跳转到日历页面
    openCalendarPage();
    
    console.log('📅 打开日历页面');
  });
  
  console.log('✅ 日历按钮初始化完成');
}

/**
 * openCalendarPage — 打开日历页面
 */
function openCalendarPage() {
  // 获取当前选中的日期（使用本地时区）
  const currentDate = selectedDate || (() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();
  
  // 跳转到日历页面
  const calendarUrl = `${window.location.origin}${window.location.pathname.replace('/index.html', '').replace('/daily.html', '')}/src/calendar.html?date=${currentDate}`;
  
  console.log('🔗 跳转到日历页面:', calendarUrl);
  window.location.href = calendarUrl;
}

// -----------------------------
// Public API / 对外导出
// -----------------------------
window.initDaily = initDaily;
window.destroyDaily = destroyDaily;
window.openImageModal = openImageModal;
})();
