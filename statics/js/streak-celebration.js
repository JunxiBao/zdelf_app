/**
 * streak-celebration.js
 * 连胜庆祝动画 - 紫色主题 + Capacitor 震动 + 文案在圆环下面 + 核心居中
 */

(function () {
  'use strict';

  let isAnimating = false;
  let currentAnimation = null;

  /**
   * 多渠道震动封装（优先适配 Capacitor）
   * @param {'start'|'success'|'celebrate'} pattern
   */
  function triggerHaptic(pattern = 'success') {
    try {
      const cap = window.Capacitor;
      const capPlugins = cap && cap.Plugins;
      const capHaptics = capPlugins && capPlugins.Haptics;
      const globalHaptics = window.Haptics;

      const impact = async (style) => {
        if (capHaptics && typeof capHaptics.impact === 'function') {
          await capHaptics.impact({ style }); // 'Heavy' | 'Medium' | 'Light'
          return true;
        }
        if (globalHaptics && typeof globalHaptics.impact === 'function') {
          await globalHaptics.impact({ style });
          return true;
        }
        return false;
      };

      const notify = async (type) => {
        if (capHaptics && typeof capHaptics.notification === 'function') {
          await capHaptics.notification({ type }); // 'SUCCESS' | 'WARNING' | 'ERROR'
          return true;
        }
        if (globalHaptics && typeof globalHaptics.notification === 'function') {
          await globalHaptics.notification({ type });
          return true;
        }
        return false;
      };

      (async () => {
        if (pattern === 'start') {
          if (await impact('Medium')) return;
        } else if (pattern === 'success') {
          if (await impact('Heavy')) return;
        } else if (pattern === 'celebrate') {
          if (await notify('SUCCESS')) return;
          if (await impact('Heavy')) return;
        }

        // 回退到你原来的方案
        if (window.HapticManager && typeof window.HapticManager.impact === 'function') {
          const style = pattern === 'start' ? 'Medium' : 'Heavy';
          window.HapticManager.impact(style, { context: 'streak-celebration' });
          return;
        }
        if (typeof window.__hapticImpact__ === 'function') {
          const style = pattern === 'start' ? 'Medium' : 'Heavy';
          window.__hapticImpact__(style);
          return;
        }
      })();
    } catch (e) {
      console.warn('[streak-celebration] 震动调用失败:', e);
    }
  }

  /**
   * 检测文字是否超出屏幕，如果超出则自动减小字体大小
   * @param {HTMLElement} textElement - 文字元素
   * @param {HTMLElement} containerElement - 容器元素
   */
  function adjustTextSizeIfNeeded(textElement, containerElement) {
    if (!textElement || !containerElement) return;
    
    // 获取屏幕可用宽度（留出一些边距）
    const screenWidth = window.innerWidth;
    const padding = 40; // 左右各留20px边距
    const maxWidth = screenWidth - padding;
    
    // 获取当前字体大小（从计算后的样式）
    const computedStyle = window.getComputedStyle(textElement);
    let currentFontSize = parseFloat(computedStyle.fontSize);
    const minFontSize = 20; // 最小字体大小，避免文字太小看不清
    
    // 如果已经设置了内联样式，使用内联样式的大小
    if (textElement.style.fontSize) {
      currentFontSize = parseFloat(textElement.style.fontSize);
    }
    
    // 保存原始字体大小作为基准
    const originalFontSize = currentFontSize;
    
    // 检测文字宽度
    const checkWidth = () => {
      const textWidth = textElement.scrollWidth;
      
      // 如果文字宽度超出屏幕，减小字体大小
      if (textWidth > maxWidth && currentFontSize > minFontSize) {
        // 计算新的字体大小（留出5%的余量）
        const scale = (maxWidth * 0.95) / textWidth;
        currentFontSize = Math.max(minFontSize, currentFontSize * scale);
        
        // 应用新的字体大小
        textElement.style.fontSize = `${currentFontSize}px`;
        
        // 同时调整数字的字体大小（保持相对比例）
        const numberSpans = textElement.querySelectorAll('.streak-number-text');
        numberSpans.forEach(span => {
          const numberComputedStyle = window.getComputedStyle(span);
          let numberFontSize = parseFloat(numberComputedStyle.fontSize);
          
          // 如果数字有内联样式，使用内联样式
          if (span.style.fontSize) {
            numberFontSize = parseFloat(span.style.fontSize);
          }
          
          // 计算数字相对于原始文字大小的比例
          const numberRatio = numberFontSize / originalFontSize;
          // 应用新的数字字体大小（保持比例）
          const newNumberFontSize = currentFontSize * numberRatio;
          span.style.fontSize = `${newNumberFontSize}px`;
        });
        
        // 再次检测，确保调整后仍然合适
        requestAnimationFrame(() => {
          const newTextWidth = textElement.scrollWidth;
          if (newTextWidth > maxWidth && currentFontSize > minFontSize) {
            checkWidth(); // 递归调整直到合适
          }
        });
      }
    };
    
    // 直接检测（因为已经在显示前调用，DOM已经渲染）
    checkWidth();
  }

  /**
   * 获取随机鼓励语（包含天数）
   * @param {number} days - 打卡天数
   * @returns {string} 鼓励语
   */
  function getDailyEncouragement(days) {
    const encouragements = [
      `连续打卡${days}天，真棒！`,
      `坚持打卡${days}天，了不起！`,
      `连续${days}天打卡，你很强！`,
      `打卡${days}天，真不错！`,
      `${days}天打卡，很棒！`,
      `连续打卡${days}天，做得好！`,
      `${days}天连续打卡，真厉害！`,
      `打卡${days}天，太棒了！`,
      `坚持打卡${days}天，真不错！`,
      `${days}天打卡，继续！`,
      `连续打卡${days}天，很棒！`,
      `打卡${days}天，真棒！`,
      `${days}天坚持打卡，了不起！`,
      `连续${days}天打卡，做得好！`,
      `坚持打卡${days}天，继续！`,
      `${days}天打卡，太棒了！`,
      `打卡${days}天，真不错！`,
      `连续打卡${days}天，很棒！`,
      `${days}天连续打卡，了不起！`,
      `打卡${days}天，做得好！`
    ];

    // 纯随机选择
    const index = Math.floor(Math.random() * encouragements.length);
    return encouragements[index];
  }

  /**
   * 显示连胜庆祝动画
   */
  function showStreakCelebration(previousStreak, newStreak, options = {}) {
    console.log('[streak-celebration] 🎉🎉🎉 showStreakCelebration 被调用！');
    console.log('[streak-celebration] 动画参数:', {
      previousStreak: previousStreak,
      newStreak: newStreak,
      options: options,
      isAnimating: isAnimating
    });
    
    if (isAnimating) {
      console.log('[streak-celebration] ⚠️ 动画正在进行中，跳过本次调用');
      return;
    }
    isAnimating = true;
    console.log('[streak-celebration] ✅ 开始创建动画元素...');

    const config = {
      duration: 3000,
      onComplete: null,
      ...options,
    };

    const mask = document.createElement('div');
    mask.className = 'streak-celebration-mask';
    mask.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center,
        rgba(12, 10, 32, 0.98) 0%,
        rgba(3, 4, 10, 0.99) 55%,
        rgba(0, 0, 0, 1) 100%);
      backdrop-filter: blur(24px) saturate(200%);
      -webkit-backdrop-filter: blur(24px) saturate(200%);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    const container = document.createElement('div');
    container.className = 'streak-celebration-container';
    container.style.cssText = `
      position: relative;
      text-align: center;
      color: white;
      transform: scale(0.7) translateY(16px);
      opacity: 0;
      filter: blur(10px);
      transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // 获取图片路径的辅助函数（相对于 www 目录）
    const getImagePath = (path) => {
      // 从脚本标签获取基础路径
      const scripts = document.getElementsByTagName('script');
      for (let script of scripts) {
        if (script.src && script.src.includes('streak-celebration.js')) {
          const scriptPath = script.src;
          const basePath = scriptPath.substring(0, scriptPath.lastIndexOf('/'));
          // 从 statics/js 返回到 www 目录
          return basePath.replace('/statics/js', '') + '/' + path.replace('../', '');
        }
      }
      // 回退：尝试常见的路径
      return path;
    };

    // 灯泡图片（上方）- 开始时使用暗色
    const bulbContainer = document.createElement('div');
    bulbContainer.className = 'streak-bulb-container';
    const bulbImg = document.createElement('img');
    bulbImg.src = getImagePath('images/svg/bulb_dark.svg');
    bulbImg.className = 'streak-bulb';
    bulbImg.alt = '灯泡';
    bulbContainer.appendChild(bulbImg);

    // 中间文字：每日随机鼓励语（包含天数）
    const streakTextContainer = document.createElement('div');
    streakTextContainer.className = 'streak-text-container';
    streakTextContainer.style.opacity = '0'; // 初始隐藏
    const streakText = document.createElement('div');
    streakText.className = 'streak-text';
    
    // 获取每日随机鼓励语
    const encouragement = getDailyEncouragement(newStreak);
    
    // 解析鼓励语，找出数字并突出显示
    const parts = encouragement.split(/(\d+)/);
    parts.forEach((part) => {
      if (/^\d+$/.test(part)) {
        // 如果是数字，用特殊样式突出显示
        const numberSpan = document.createElement('span');
        numberSpan.className = 'streak-number-text';
        numberSpan.textContent = part;
        
        // 根据数字位数动态调整缩放比例，让不同位数的数字占用相同空间
        const digitCount = part.length;
        let scaleMultiplier = 1;
        
        // 根据位数确定缩放倍数，让不同位数的数字占用相同的视觉空间
        if (digitCount === 1) {
          scaleMultiplier = 1; // 1位数：保持基础大小
        } else if (digitCount === 2) {
          scaleMultiplier = 0.85; // 2位数：缩小到85%
        } else if (digitCount === 3) {
          scaleMultiplier = 0.7; // 3位数：缩小到70%
        } else if (digitCount === 4) {
          scaleMultiplier = 0.6; // 4位数：缩小到60%
        } else {
          scaleMultiplier = 0.5; // 5位数及以上：缩小到50%
        }
        
        // 先添加到 DOM，然后读取计算后的样式来获取基础 scale
        streakText.appendChild(numberSpan);
        
        // 使用 requestAnimationFrame 确保样式已应用后再调整 scale
        requestAnimationFrame(() => {
          // 读取计算后的 transform 值
          const computedStyle = window.getComputedStyle(numberSpan);
          const transform = computedStyle.transform;
          
          // 解析 transform 矩阵获取当前的 scale 值
          // transform 矩阵格式：matrix(scaleX, skewY, skewX, scaleY, translateX, translateY)
          let currentScale = 1.3; // 默认值
          if (transform && transform !== 'none') {
            const matrix = transform.match(/matrix\(([^)]+)\)/);
            if (matrix) {
              const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
              if (values.length >= 4) {
                // scaleX 和 scaleY 应该相同（因为我们只使用 scale，没有 skew）
                currentScale = Math.abs(values[0]);
              }
            }
          }
          
          // 计算最终 scale 值
          const finalScale = currentScale * scaleMultiplier;
          
          // 应用最终的 scale，使用 !important 确保覆盖 CSS
          numberSpan.style.setProperty('transform', `scale(${finalScale})`, 'important');
        });
      } else if (part) {
        // 如果是文字，直接添加
        streakText.appendChild(document.createTextNode(part));
      }
    });
    
    streakTextContainer.appendChild(streakText);

    // 庆祝图片（下方）- 开始时使用暗色
    const celebrationContainer = document.createElement('div');
    celebrationContainer.className = 'streak-celebration-image-container';
    const celebrationImg = document.createElement('img');
    celebrationImg.src = getImagePath('images/celebration_dark.png');
    celebrationImg.className = 'streak-celebration-image';
    celebrationImg.alt = '庆祝';
    celebrationContainer.appendChild(celebrationImg);

    // 保留原有的粒子效果容器（用于特效）
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'streak-particles';


    const isWeekMilestone = newStreak % 7 === 0 && newStreak > 0;

    let confettiContainer = null;
    if (isWeekMilestone) {
      confettiContainer = document.createElement('div');
      confettiContainer.className = 'streak-confetti-container';
    }

    let tier = 'normal';
    if (isWeekMilestone) tier = 'week';

    container.dataset.streakTier = tier;
    container.classList.add(`streak-tier-${tier}`);

    // 组装：灯泡（上） + 文字（中） + 庆祝图片（下） + 粒子特效
    container.appendChild(bulbContainer);
    container.appendChild(streakTextContainer);
    container.appendChild(celebrationContainer);
    container.appendChild(particlesContainer);

    mask.appendChild(container);
    if (confettiContainer) mask.appendChild(confettiContainer);
    document.body.appendChild(mask);
    console.log('[streak-celebration] ✅ 动画元素已添加到DOM，开始播放动画');

    if (!document.getElementById('streak-celebration-styles')) {
      const style = document.createElement('style');
      style.id = 'streak-celebration-styles';
      style.textContent = getStreakCelebrationStyles();
      document.head.appendChild(style);
    }

    // 在文字显示之前就计算好大小
    // 使用 visibility: hidden 而不是 opacity: 0，这样元素仍然占据空间，可以正确计算宽度
    streakTextContainer.style.visibility = 'hidden';
    streakText.style.visibility = 'hidden';
    
    // 等待DOM渲染和样式应用完成后再计算
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // 计算并调整文字大小
        adjustTextSizeIfNeeded(streakText, streakTextContainer);
        
        // 计算完成后，恢复 visibility，但保持 opacity 为 0（等待显示时机）
        streakTextContainer.style.visibility = 'visible';
        streakText.style.visibility = 'visible';
      });
    });

    requestAnimationFrame(() => {
      mask.style.opacity = '1';
      container.style.transform = 'scale(1) translateY(0)';
      container.style.opacity = '1';
      container.style.filter = 'blur(0px)';

      // 动画刚开始：轻震
      triggerHaptic('start');

      // 灯泡掉落动画
      // 开始时灯泡在屏幕上方（隐藏），使用暗色
      // 计算最终的 translateY 值（考虑响应式偏移）
      let finalTranslateY = '-30px';
      if (window.innerWidth <= 480) {
        finalTranslateY = '-20px';
      } else if (window.innerWidth <= 768) {
        finalTranslateY = '-25px';
      } else if (window.innerWidth >= 1200) {
        finalTranslateY = '-50px';
      } else if (window.innerWidth >= 769) {
        finalTranslateY = '-40px';
      }

      bulbContainer.style.transform = `translateY(calc(-400px + ${finalTranslateY}))`;
      bulbContainer.style.opacity = '0';
      bulbContainer.style.transition = 'none';

      // 延迟后开始掉落
        setTimeout(() => {
        bulbContainer.style.transition = 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out';
        bulbContainer.style.transform = `translateY(${finalTranslateY})`;
        bulbContainer.style.opacity = '1';

        // 灯泡掉到底部时，点亮并切换图片
        setTimeout(() => {
          // 切换为亮色灯泡
          bulbImg.src = getImagePath('images/svg/bulb.svg');
          bulbImg.style.transition = 'opacity 0.3s ease-in';
          
          // 切换为亮色庆祝图片
          celebrationImg.src = getImagePath('images/celebration.png');
          celebrationImg.style.transition = 'opacity 0.3s ease-in';

          // 设置 CSS 变量，确保摆动动画使用正确的位置
          bulbImg.style.setProperty('--bulb-final-y', '0px');
          
          // 在下一帧确保位置一致，避免闪烁
          requestAnimationFrame(() => {
            // 保持容器的 transform 不变（继续使用掉落结束时的位置）
            // 只让灯泡在容器内摆动，不改变容器的位置
            bulbContainer.style.transition = 'none';
            // 确保容器保持在掉落结束的位置（使用 !important 覆盖 CSS）
            bulbContainer.style.setProperty('transform', `translateY(${finalTranslateY})`, 'important');
            
            // 设置灯泡的初始 transform，确保和摆动动画的起始帧（0%）完全一致
            // 摆动动画的 0% 是 rotate(0deg)，所以这里也设置为 0deg
            bulbImg.style.transform = 'translateX(-50%) translateY(0) rotate(0deg)';
            
            // 添加点亮闪烁效果
            bulbContainer.style.animation = 'bulbLightUp 0.5s ease-out forwards';
            
            // 点亮动画结束后，保持发光效果
            setTimeout(() => {
              bulbContainer.classList.add('bulb-lit');
              // 确保容器保持发光，避免亮度突然下降
              bulbContainer.style.filter = 'drop-shadow(0 0 15px rgba(243, 250, 209, 0.7))';
            }, 500);
            
            // 延迟一小段时间后启动摆动动画，让过渡更平滑
            // 使用 linear 缓动函数，让摆动速度保持一致
            // 在发光动画启动前，先设置初始发光效果，避免亮度突然下降
            setTimeout(() => {
              // 先给灯泡图片添加类，确保有发光效果
              bulbImg.classList.add('bulb-glowing');
              // 先设置初始发光效果，确保与点亮后的亮度一致
              bulbImg.style.filter = 'drop-shadow(0 0 15px rgba(243, 250, 209, 0.7))';
              // 然后启动摆动和发光动画，发光动画会覆盖 filter，但初始值已经设置好了
              bulbImg.style.animation = 'bulbSwing 2.5s linear infinite, bulbGlow 2s ease-in-out 0.5s infinite';
            }, 100);
          });

          // 震动反馈
          triggerHaptic('success');

          // 在点亮瞬间显示文字（大小已经在之前计算好了）
          streakTextContainer.style.opacity = '1';
          streakTextContainer.style.transition = 'opacity 0.5s ease-in';
          // 确保文字本身也是可见的
          streakText.style.opacity = '1';
        }, 1200);

        // 7天里程碑彩带效果
        if (isWeekMilestone && confettiContainer) {
          setTimeout(() => {
            createConfetti(confettiContainer, tier);
            triggerHaptic('celebrate');
          }, 1700);
          }
        }, 300);

      setTimeout(() => {
        // 动画显示完成后，让灯泡继续摇动一段时间（额外2秒）
        // 灯泡的摆动动画已经是 infinite，所以会持续摇动
        
        // 延迟后开始淡出动画
      setTimeout(() => {
        mask.style.opacity = '0';
        container.style.transform = 'scale(0.95) translateY(-10px)';
        container.style.opacity = '0';
        container.style.filter = 'blur(5px)';

        setTimeout(() => {
            // 在完全关闭前，确保灯泡继续摇动
            // 摆动动画会一直持续到元素被移除
          mask.remove();
          isAnimating = false;
          if (config.onComplete) config.onComplete();
        }, 500);
        }, 2000); // 额外显示2秒，让灯泡继续摇动
      }, config.duration);
    });

    currentAnimation = { mask, container };
  }

  /**
   * 粒子效果
   */
  function createParticles(container, particlesContainer, tier) {
    const isDarkMode =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const colors = isDarkMode
      ? ['#f5d0fe', '#e879f9', '#c4b5fd', '#a855f7', '#e0e7ff']
      : ['#a855f7', '#c4b5fd', '#e879f9', '#9333ea', '#e0e7ff'];

    let particleCount = 20;
    if (tier === 'normal') particleCount = 20;
    else if (tier === 'week') particleCount = 26;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'streak-particle';

      const angle =
        (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.3;
      const distance = 100 + Math.random() * 60;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 4 + Math.random() * 5;
      const duration = 1.2 + Math.random() * 0.6;
      const delay = Math.random() * 0.2;

      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, ${color} 0%, ${color}80 50%, transparent 100%);
        border-radius: 50%;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        box-shadow:
          0 0 ${size * 2}px ${color},
          0 0 ${size * 4}px ${color}90;
        animation: particleElegantExplode ${duration}s ease-out ${delay}s forwards;
        --target-x: ${x}px;
        --target-y: ${y}px;
        opacity: 0;
      `;

      particlesContainer.appendChild(particle);
    }
  }

  /**
   * 彩带（周里程碑）
   */
  function createConfetti(confettiContainer, tier) {
    const colors = [
      '#a855f7',
      '#c4b5fd',
      '#e879f9',
      '#f5d0fe',
      '#6366f1',
      '#4f46e5',
      '#facc15',
    ];

    let confettiCount = 50;
    if (tier === 'week') confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'streak-confetti';

      const startX = Math.random() * 100;
      const startY = -10 - Math.random() * 20;
      const rotation = Math.random() * 360;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 8 + Math.random() * 12;
      const isRound = Math.random() > 0.5;
      const duration = 2 + Math.random() * 1.5;
      const delay = Math.random() * 0.5;
      const driftX = (Math.random() - 0.5) * 200;

      confetti.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        left: ${startX}%;
        top: ${startY}%;
        border-radius: ${isRound ? '50%' : '3px'};
        opacity: 0;
        box-shadow: 0 0 ${size}px ${color};
        --drift-x: ${driftX}px;
        --rotation: ${rotation}deg;
        animation: confettiFall ${duration}s ease-in ${delay}s forwards;
      `;

      confettiContainer.appendChild(confetti);
    }
  }

  /**
   * 100 天爆炸特效
   */
  function createExplosionEffect(explosionContainer) {
    const isDarkMode =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const colors = isDarkMode
      ? ['#e879f9', '#c4b5fd', '#a855f7', '#f5d0fe', '#facc15', '#eab308']
      : ['#a855f7', '#c4b5fd', '#e879f9', '#f5d0fe', '#facc15', '#eab308'];

    const waveCount = 4;
    for (let i = 0; i < waveCount; i++) {
      const wave = document.createElement('div');
      const delay = i * 0.12;
      const size = 160 + i * 80;
      const color = colors[i % colors.length];

      wave.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${2 + i}px solid ${color};
        box-shadow:
          0 0 ${30 + i * 12}px ${color},
          0 0 ${60 + i * 20}px ${color}90,
          inset 0 0 ${24 + i * 10}px ${color}60;
        opacity: 0;
        animation: explosionWave ${1 + i * 0.18}s ease-out ${delay}s forwards;
      `;
      explosionContainer.appendChild(wave);
    }

    for (let i = 0; i < 3; i++) {
      const flash = document.createElement('div');
      const delay = i * 0.1;
      const size = 240 + i * 90;
      const color = colors[(i + 2) % colors.length];

      const hexToRgb = (hex) => {
        const result =
          /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
          : null;
      };
      const rgb = hexToRgb(color);
      const rgba1 = rgb
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95)`
        : color;
      const rgba2 = rgb
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`
        : color;
      const rgba3 = rgb
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`
        : color;

      flash.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: radial-gradient(circle,
          ${rgba1} 0%,
          ${rgba2} 20%,
          ${rgba3} 40%,
          transparent 70%);
        opacity: 0;
        animation: explosionFlash ${0.8 + i * 0.25}s ease-out ${delay}s forwards;
        filter: blur(${18 + i * 8}px);
      `;
      explosionContainer.appendChild(flash);
    }

    const particleCount = 55;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const angle =
        (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.8;
      const distance = 200 + Math.random() * 140;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 7 + Math.random() * 10;
      const duration = 1.2 + Math.random() * 0.6;
      const delay = Math.random() * 0.15;

      particle.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, ${color} 0%, ${color}80 50%, transparent 100%);
        border-radius: 50%;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        box-shadow:
          0 0 ${size * 3}px ${color},
          0 0 ${size * 6}px ${color}90;
        animation: explosionParticle ${duration}s ease-out ${delay}s forwards;
        --target-x: ${x}px;
        --target-y: ${y}px;
        opacity: 0;
      `;
      explosionContainer.appendChild(particle);
    }

    const starCount = 10;
    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      const angle = (Math.PI * 2 * i) / starCount;
      const distance = 170;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const color = colors[i % colors.length];
      const delay = 0.1 + i * 0.05;

      star.style.cssText = `
        position: absolute;
        width: 20px;
        height: 20px;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: ${color};
        clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        box-shadow:
          0 0 20px ${color},
          0 0 40px ${color}90;
        opacity: 0;
        animation: explosionStar 1.5s ease-out ${delay}s forwards;
        --target-x: ${x}px;
        --target-y: ${y}px;
      `;
      explosionContainer.appendChild(star);
    }
  }

  function getStreakCelebrationStyles() {
    return `
      @keyframes textFadeIn {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 1;
        }
      }

      @keyframes bulbSwing {
        0% {
          transform: translateX(-50%) translateY(0) rotate(0deg);
        }
        25% {
          transform: translateX(-50%) translateY(0) rotate(4deg);
        }
        50% {
          transform: translateX(-50%) translateY(0) rotate(0deg);
        }
        75% {
          transform: translateX(-50%) translateY(0) rotate(-4deg);
        }
        100% {
          transform: translateX(-50%) translateY(0) rotate(0deg);
        }
      }

      @keyframes bulbLightUp {
        0% {
          filter: brightness(0.3) drop-shadow(0 0 5px rgba(243, 250, 209, 0.3));
        }
        50% {
          filter: brightness(1.5) drop-shadow(0 0 25px rgba(243, 250, 209, 0.9));
        }
        100% {
          filter: brightness(1) drop-shadow(0 0 15px rgba(243, 250, 209, 0.7));
        }
      }
      
      /* 点亮后保持发光效果 */
      .streak-bulb-container.bulb-lit {
        filter: drop-shadow(0 0 15px rgba(243, 250, 209, 0.7));
      }

      @keyframes bulbGlow {
        0%, 100% {
          filter: drop-shadow(0 0 15px rgba(243, 250, 209, 0.7));
        }
        50% {
          filter: drop-shadow(0 0 25px rgba(243, 250, 209, 0.9));
        }
      }
      
      /* 确保灯泡图片在发光动画启动前就有发光效果 */
      .streak-bulb.bulb-glowing {
        filter: drop-shadow(0 0 15px rgba(243, 250, 209, 0.7));
        }


      @keyframes particleElegantExplode {
        0% {
          transform: translate(-50%, -50%) scale(0) rotate(0deg);
          opacity: 0;
        }
        10% {
          transform: translate(-50%, -50%) scale(1.2) rotate(180deg);
          opacity: 1;
        }
        100% {
          transform: translate(calc(-50% + var(--target-x)), calc(-50% + var(--target-y))) scale(0) rotate(540deg);
          opacity: 0;
        }
      }

      @keyframes glowPulse {
        0%, 100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.7;
        }
        40% {
          transform: translate(-50%, -50%) scale(1.08);
          opacity: 1;
        }
        70% {
          transform: translate(-50%, -50%) scale(0.97);
          opacity: 0.8;
        }
      }

      @keyframes labelFadeIn {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes messageFadeIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes messageElegantPulse {
        0%, 100% {
          transform: scale(1);
          opacity: 0.92;
        }
        50% {
          transform: scale(1.02);
          opacity: 1;
        }
      }

      @keyframes ringRotate {
        0% {
          transform: translate(-50%, -50%) rotate(0deg) scale(1);
        }
        50% {
          transform: translate(-50%, -50%) rotate(180deg) scale(1.03);
        }
        100% {
          transform: translate(-50%, -50%) rotate(360deg) scale(1);
        }
      }

      @keyframes flameFlicker {
        0%, 100% {
          transform: translate(-50%, 0) scale(1, 1);
          opacity: 0.85;
        }
        30% {
          transform: translate(-50%, -4px) scale(1.05, 1.08);
          opacity: 1;
        }
        60% {
          transform: translate(-50%, 2px) scale(0.96, 0.96);
          opacity: 0.8;
        }
      }

      @keyframes gradientShift {
        0%, 100% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
      }

      .streak-celebration-mask {
        box-sizing: border-box;
      }

      .streak-celebration-container {
        position: relative;
        padding: 0;
        min-width: 0;
        background: none;
        border-radius: 0;
        border: none;
        box-shadow: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        gap: 0;
        width: 100%;
        max-width: 100%;
        height: 100%;
      }

      .streak-bulb-container {
        position: relative;
        width: 108px;
        height: 295px;
        margin: 0 auto;
        z-index: 10;
        flex-shrink: 0;
        transform: translateY(-30px);
        will-change: transform, opacity;
      }

      .streak-bulb {
        width: 108px;
        height: 295px;
        object-fit: contain;
        display: block;
        margin: 0 auto;
        padding: 0;
        transform-origin: center top;
        position: relative;
        left: 50%;
        transform: translateX(-50%) translateY(0);
        /* 动画会覆盖 transform，所以这里设置初始值 */
      }

      .streak-text-container {
        position: relative;
        z-index: 5;
        margin: -50px auto 0 auto;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        flex: 0 0 auto;
        opacity: 0;
        transition: opacity 0.5s ease-in;
      }

      .streak-text {
        position: relative;
        font-size: 32px;
        font-weight: 700;
        color: white;
        text-align: center;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        letter-spacing: 0.05em;
        white-space: nowrap;
        opacity: 1;
        margin: 0 auto;
        display: block;
      }

      .streak-number-text {
        font-size: 1.8em;
        font-weight: 900;
        color: #fff;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
        display: inline-block;
        transform: scale(1.3);
        margin: 0 6px;
        letter-spacing: 0.05em;
      }

      .streak-celebration-image-container {
        position: relative;
        width: 300px;
        height: auto;
        max-width: 80vw;
        z-index: 3;
        margin: 0;
        flex-shrink: 0;
      }

      .streak-celebration-image {
        width: 100%;
        height: auto;
        object-fit: contain;
        transition: opacity 0.3s ease-in;
      }

      /* 响应式设计 - 手机端 */
      @media (max-width: 768px) {
        .streak-bulb-container {
          width: 80px;
          height: 220px;
          margin: 0 auto;
          transform: translateY(-25px);
        }

        .streak-bulb {
          /* transform 由 JavaScript 控制，不在这里设置 */
          /* --bulb-offset-y 不再使用，位置由容器控制 */
      }

        .streak-text {
          font-size: 32px;
        }

        .streak-number-text {
          font-size: 1.8em;
          transform: scale(1.25);
        }

        .streak-text-container {
          margin: -40px auto 0 auto;
          flex: 0 0 auto;
        display: flex;
          justify-content: center;
        align-items: center;
        }

        .streak-celebration-image-container {
          width: 250px;
          max-width: 85vw;
          margin: 0;
          flex-shrink: 0;
          transform: translateY(-80px);
        }
      }

      /* 响应式设计 - 小屏手机 */
      @media (max-width: 480px) {
        .streak-bulb-container {
          width: 70px;
          height: 190px;
          margin: 0 auto;
          transform: translateY(-20px);
        }

        .streak-bulb {
          /* transform 由 JavaScript 控制，不在这里设置 */
          /* --bulb-offset-y 不再使用，位置由容器控制 */
        }

        .streak-text {
          font-size: 28px;
        }

        .streak-number-text {
          font-size: 1.8em;
          transform: scale(1.25);
        }

        .streak-text-container {
          margin: -35px auto 0 auto;
          flex: 0 0 auto;
          display: flex;
        justify-content: center;
          align-items: center;
      }

        .streak-celebration-image-container {
          width: 220px;
          max-width: 90vw;
          margin: 0;
          flex-shrink: 0;
          transform: translateY(-70px);
        }
      }

      /* 响应式设计 - 电脑端 */
      @media (min-width: 769px) {
        .streak-bulb-container {
          width: 120px;
          height: 330px;
          margin: 0 auto;
          transform: translateY(-40px);
        }

        .streak-text {
          font-size: 40px;
        }

        .streak-number-text {
          font-size: 2em;
          transform: scale(1.35);
        }

        .streak-text-container {
          margin: -60px auto 0 auto;
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .streak-celebration-image-container {
          width: 350px;
          margin: 0;
          flex-shrink: 0;
      }
      }

      /* 响应式设计 - 大屏电脑 */
      @media (min-width: 1200px) {
        .streak-bulb-container {
          width: 140px;
          height: 385px;
          margin: 0 auto;
          transform: translateY(-50px);
      }

        .streak-text {
          font-size: 48px;
        }

        .streak-number-text {
          font-size: 2.1em;
          transform: scale(1.4);
        }

        .streak-text-container {
          margin: -90px auto 0 auto;
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .streak-celebration-image-container {
          width: 400px;
          margin: 0;
          flex-shrink: 0;
          max-width: 100%;
        }
      }

      @media (prefers-color-scheme: dark) {
        .streak-celebration-mask {
          background: radial-gradient(circle at center,
            rgba(15, 23, 42, 0.98) 0%,
            rgba(3, 4, 10, 1) 55%,
            rgba(0, 0, 0, 1) 100%);
      }
      }


      .streak-particles {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 4;
      }
      .streak-particle { will-change: transform, opacity; }

      .streak-confetti-container {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 10;
        overflow: hidden;
      }

      @keyframes confettiFall {
        0% {
          transform: translate(0, 0) rotate(var(--rotation)) scale(1);
          opacity: 0;
        }
        12% {
          opacity: 1;
        }
        90% {
          opacity: 0.9;
        }
        100% {
          transform: translate(var(--drift-x), 110vh) rotate(calc(var(--rotation) + 720deg)) scale(0.45);
          opacity: 0;
        }
      }

      .streak-confetti { will-change: transform, opacity; }

      .streak-explosion-container {
        position: absolute;
        inset: 0;
        transform: translate(0, 0);
        pointer-events: none;
        z-index: 0;
        overflow: visible;
      }

      @keyframes explosionWave {
        0% {
          transform: translate(-50%, -50%) scale(0);
          opacity: 1;
        }
        30% {
          opacity: 0.9;
        }
        100% {
          transform: translate(-50%, -50%) scale(3.1);
          opacity: 0;
        }
      }

      @keyframes explosionFlash {
        0% {
          transform: translate(-50%, -50%) scale(0);
          opacity: 1;
        }
        25% {
          opacity: 1;
        }
        55% {
          opacity: 0.7;
        }
        100% {
          transform: translate(-50%, -50%) scale(2.4);
          opacity: 0;
        }
      }

      @keyframes explosionParticle {
        0% {
          transform: translate(-50%, -50%) scale(0) rotate(0deg);
          opacity: 0;
        }
        8% {
          transform: translate(-50%, -50%) scale(1.7) rotate(120deg);
          opacity: 1;
        }
        100% {
          transform: translate(calc(-50% + var(--target-x)), calc(-50% + var(--target-y))) scale(0) rotate(900deg);
          opacity: 0;
        }
      }

      @keyframes explosionStar {
        0% {
          transform: translate(-50%, -50%) scale(0) rotate(0deg);
          opacity: 0;
        }
        25% {
          transform: translate(-50%, -50%) scale(1.5) rotate(180deg);
          opacity: 1;
        }
        100% {
          transform: translate(calc(-50% + var(--target-x)), calc(-50% + var(--target-y))) scale(0.35) rotate(720deg);
          opacity: 0;
        }
      }

      .streak-explosion-wave,
      .streak-explosion-flash,
      .streak-explosion-particle,
      .streak-explosion-star {
        will-change: transform, opacity;
      }

      /* 等级分层 - 基础样式 */
      /* Normal 和 Week 等级使用相同的布局 */
      .streak-tier-normal .streak-text,
      .streak-tier-week .streak-text {
        font-size: 36px;
      }
      .streak-tier-normal .streak-number-text,
      .streak-tier-week .streak-number-text {
        font-size: 1.8em;
        transform: scale(1.3);
      }
      .streak-tier-normal .streak-bulb-container,
      .streak-tier-week .streak-bulb-container {
        width: 115px;
        height: 310px;
      }
      .streak-tier-normal .streak-celebration-image-container,
      .streak-tier-week .streak-celebration-image-container {
        width: 320px;
        margin: 0;
      }

      /* 等级分层 - 响应式适配（手机端） */
      @media (max-width: 768px) {
        .streak-tier-normal .streak-text,
        .streak-tier-week .streak-text { font-size: 36px; }
        .streak-tier-normal .streak-number-text,
        .streak-tier-week .streak-number-text { font-size: 1.9em; transform: scale(1.25); }
        .streak-tier-normal .streak-bulb-container,
        .streak-tier-week .streak-bulb-container { width: 90px; height: 245px; }
        .streak-tier-normal .streak-celebration-image-container,
        .streak-tier-week .streak-celebration-image-container { width: 260px; margin: 0; transform: translateY(-80px); }
      }

      @media (max-width: 480px) {
        .streak-tier-normal .streak-text,
        .streak-tier-week .streak-text { font-size: 32px; }
        .streak-tier-normal .streak-number-text,
        .streak-tier-week .streak-number-text { font-size: 1.9em; transform: scale(1.25); }
        .streak-tier-normal .streak-bulb-container,
        .streak-tier-week .streak-bulb-container { width: 80px; height: 220px; }
        .streak-tier-normal .streak-celebration-image-container,
        .streak-tier-week .streak-celebration-image-container { width: 240px; margin: 0; transform: translateY(-70px); }
      }

      /* 等级分层 - 响应式适配（电脑端） */
      @media (min-width: 769px) {
        .streak-tier-normal .streak-text,
        .streak-tier-week .streak-text { font-size: 44px; }
        .streak-tier-normal .streak-number-text,
        .streak-tier-week .streak-number-text { font-size: 2em; transform: scale(1.35); }
        .streak-tier-normal .streak-bulb-container,
        .streak-tier-week .streak-bulb-container { width: 130px; height: 355px; }
        .streak-tier-normal .streak-text-container,
        .streak-tier-week .streak-text-container {
          margin: -60px auto 0 auto;
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
      }
        .streak-tier-normal .streak-celebration-image-container,
        .streak-tier-week .streak-celebration-image-container { width: 380px; margin: 0; flex-shrink: 0; }
      }

      @media (min-width: 1200px) {
        .streak-tier-normal .streak-text,
        .streak-tier-week .streak-text { font-size: 52px; }
        .streak-tier-normal .streak-number-text,
        .streak-tier-week .streak-number-text { font-size: 2.1em; transform: scale(1.4); }
        .streak-tier-normal .streak-bulb-container,
        .streak-tier-week .streak-bulb-container { width: 150px; height: 410px; }
        .streak-tier-normal .streak-text-container,
        .streak-tier-week .streak-text-container {
          margin: -90px auto 0 auto;
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
      }
        .streak-tier-normal .streak-celebration-image-container,
        .streak-tier-week .streak-celebration-image-container { width: 440px; margin: 0; flex-shrink: 0; }
      }
    `;
  }

  // ===== 日期 & API 逻辑 =====

  function getDateString(date = new Date()) {
    try {
      // 使用 toLocaleString 获取 Asia/Shanghai 时区的日期组件
      // 但需要确保格式为数字，而不是中文
      const shanghaiDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
      const year = shanghaiDate.getFullYear();
      const month = String(shanghaiDate.getMonth() + 1).padStart(2, '0');
      const day = String(shanghaiDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (_) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  function getTodayDateString() {
    return getDateString(new Date());
  }

  async function checkFirstSubmissionToday(userId) {
    try {
      const todayStr = getTodayDateString();
      const lastSubmissionKey = `last_submission_${userId}`;
      const lastSubmissionDate = localStorage.getItem(lastSubmissionKey);

      console.log('[streak-celebration] [checkFirstSubmissionToday] 开始检查...');
      console.log('[streak-celebration] [checkFirstSubmissionToday] 今天日期:', todayStr);
      console.log('[streak-celebration] [checkFirstSubmissionToday] localStorage键:', lastSubmissionKey);
      console.log('[streak-celebration] [checkFirstSubmissionToday] localStorage值:', lastSubmissionDate);

      if (lastSubmissionDate === todayStr) {
        console.log(
          '[streak-celebration] [checkFirstSubmissionToday] ❌ localStorage显示今天已提交，不显示动画'
        );
        return { isFirst: false, previousStreak: 0, newStreak: 0 };
      }
      console.log('[streak-celebration] [checkFirstSubmissionToday] ✅ localStorage未记录今天提交');

      const API_BASE =
        (typeof window !== 'undefined' && window.__API_BASE__) ||
        'https://app.zdelf.cn';
      const baseUrl = API_BASE.endsWith('/')
        ? API_BASE.slice(0, -1)
        : API_BASE;

      const types = ['diet', 'metrics', 'case'];
      console.log('[streak-celebration] [checkFirstSubmissionToday] 检查后端API是否有今天的数据...');
      
      const checkPromises = types.map(async (type) => {
        try {
          const url = `${baseUrl}/getjson/${type}?user_id=${encodeURIComponent(
            userId
          )}&date=${todayStr}&limit=1`;
          console.log(`[streak-celebration] [checkFirstSubmissionToday] 检查 ${type}:`, url);
          
          const response = await fetch(url, { cache: 'no-cache' });
          if (!response.ok) {
            console.log(`[streak-celebration] [checkFirstSubmissionToday] ${type} API响应失败:`, response.status);
            return false;
          }
          const result = await response.json();
          const hasData = result.success && result.data && result.data.length > 0;
          console.log(`[streak-celebration] [checkFirstSubmissionToday] ${type} 检查结果:`, {
            success: result.success,
            hasData: hasData,
            dataLength: result.data?.length || 0
          });
          return hasData;
        } catch (error) {
          console.warn(
            `[streak-celebration] [checkFirstSubmissionToday] 检查${type}提交失败:`,
            error
          );
          return false;
        }
      });

      const hasSubmissionResults = await Promise.all(checkPromises);
      const hasSubmissionToday = hasSubmissionResults.some((r) => r);
      
      console.log('[streak-celebration] [checkFirstSubmissionToday] 后端API检查结果:', {
        diet: hasSubmissionResults[0],
        metrics: hasSubmissionResults[1],
        case: hasSubmissionResults[2],
        hasAnySubmission: hasSubmissionToday
      });

      if (hasSubmissionToday) {
        console.log(
          '[streak-celebration] [checkFirstSubmissionToday] ❌ 后端API显示今天已提交，不显示动画'
        );
        localStorage.setItem(lastSubmissionKey, todayStr);
        return { isFirst: false, previousStreak: 0, newStreak: 0 };
      }
      console.log('[streak-celebration] [checkFirstSubmissionToday] ✅ 后端API未发现今天的数据');

      console.log('[streak-celebration] [checkFirstSubmissionToday] 获取连续天数...');
      const response = await fetch(`${baseUrl}/stats/get_streak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
        cache: 'no-cache',
      });

      if (!response.ok) {
        console.warn('[streak-celebration] [checkFirstSubmissionToday] ❌ 获取连续天数失败，状态码:', response.status);
        return { isFirst: false, previousStreak: 0, newStreak: 0 };
      }

      const result = await response.json();
      console.log('[streak-celebration] [checkFirstSubmissionToday] 连续天数API返回:', result);
      
      if (result.success && result.data) {
        const currentStreak = result.data.current_streak || 0;
        // 如果是今天第一次提交，提交后连续天数会变成 currentStreak + 1
        // 所以 previousStreak = currentStreak, newStreak = currentStreak + 1
        const previousStreak = currentStreak;
        const newStreak = currentStreak + 1;

        console.log('[streak-celebration] [checkFirstSubmissionToday] 连续天数:', {
          currentStreak: currentStreak,
          previousStreak: previousStreak,
          newStreak: newStreak,
          note: '今天第一次提交后，连续天数将从 ' + currentStreak + ' 变成 ' + newStreak
        });

        // 即使是第一次提交（从0变成1），也应该显示动画
        localStorage.setItem(lastSubmissionKey, todayStr);
        console.log('[streak-celebration] [checkFirstSubmissionToday] ✅ 确认是今天第一次提交，连续天数将从', previousStreak, '变成', newStreak);
        return {
          isFirst: true,
          previousStreak,
          newStreak,
        };
      } else {
        console.warn('[streak-celebration] [checkFirstSubmissionToday] ⚠️ API返回数据格式不正确:', result);
      }

      return { isFirst: false, previousStreak: 0, newStreak: 0 };
    } catch (error) {
      console.warn('[streak-celebration] [checkFirstSubmissionToday] ❌ 检查首次提交失败:', error);
      return { isFirst: false, previousStreak: 0, newStreak: 0 };
    }
  }

  async function handleUploadSuccess(userId, options = {}) {
    console.log('[streak-celebration] ========== 开始检查庆祝动画 ==========');
    console.log('[streak-celebration] 用户ID:', userId);
    console.log('[streak-celebration] 选项:', options);
    
    if (!userId) {
      console.warn('[streak-celebration] ❌ 缺少用户ID，无法显示动画');
      return false;
    }

    // 检查用户是否在设置中关闭了庆祝动画
    const stored = localStorage.getItem('streak_celebration_enabled');
    const isEnabled = stored !== null ? stored === 'true' : true; // 默认开启
    console.log('[streak-celebration] 设置检查:', {
      stored: stored,
      isEnabled: isEnabled,
      note: stored === null ? '未设置，使用默认值（开启）' : `已设置: ${stored}`
    });
    
    if (!isEnabled) {
      console.log('[streak-celebration] ❌ 用户已关闭庆祝动画，跳过显示');
      return false;
    }
    console.log('[streak-celebration] ✅ 庆祝动画设置已开启');

    // 如果传入了 skipBackendCheck 选项，说明已经在上传前检查过了
    // 直接使用上传前检查的结果显示动画
    if (options.skipBackendCheck && options.checkResult) {
      console.log('[streak-celebration] ⚡️ 跳过后端检查，使用上传前检查的结果显示动画');
      return await showAnimationDirectly(userId, options.checkResult);
    }

    let checkResult = null;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      if (retryCount > 0) {
        console.log(`[streak-celebration] 重试第 ${retryCount} 次，等待1.5秒...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      console.log(`[streak-celebration] 检查今天是否第一次提交 (尝试 ${retryCount + 1}/${maxRetries + 1})...`);
      checkResult = await checkFirstSubmissionToday(userId);
      console.log('[streak-celebration] 检查结果:', checkResult);

      if (!checkResult.isFirst) {
        console.log('[streak-celebration] ❌ 不是今天第一次提交，不显示动画');
        break;
      }
      console.log('[streak-celebration] ✅ 确认是今天第一次提交');

      if (checkResult.isFirst && checkResult.newStreak > 0) {
        console.log('[streak-celebration] 获取最新连胜数据以确认...');
        const API_BASE =
          (typeof window !== 'undefined' && window.__API_BASE__) ||
          'https://app.zdelf.cn';
        const baseUrl = API_BASE.endsWith('/')
          ? API_BASE.slice(0, -1)
          : API_BASE;

        try {
          const response = await fetch(`${baseUrl}/stats/get_streak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
            cache: 'no-cache',
          });
          console.log('[streak-celebration] API响应状态:', response.status, response.ok);
          
          if (response.ok) {
            const result = await response.json();
            console.log('[streak-celebration] API返回数据:', result);
            
            if (result.success && result.data) {
              const currentStreak = result.data.current_streak || 0;
              console.log('[streak-celebration] 当前连续天数:', currentStreak);
              
              // 上传后，连续天数应该已经更新了
              // 如果上传前检查时 newStreak = 1（从0变成1），上传后应该也是1或更大
              // 直接使用上传后的值，或者使用上传前检查的结果
              if (currentStreak > 0) {
                checkResult.newStreak = currentStreak;
                checkResult.previousStreak = currentStreak > 0 ? currentStreak - 1 : 0;
                console.log('[streak-celebration] ✅ 更新连胜数据:', {
                  previousStreak: checkResult.previousStreak,
                  newStreak: checkResult.newStreak
                });
                break;
              } else {
                // 如果上传后连续天数还是0，可能是后端更新延迟
                // 但我们已经在上传前检查确认是第一次提交，所以使用上传前的结果
                console.log('[streak-celebration] ⚠️ 连续天数为0，但已确认是第一次提交，使用上传前检查的结果');
                // checkResult 已经包含了正确的 previousStreak 和 newStreak，直接使用
                break;
              }
            } else {
              console.warn('[streak-celebration] ⚠️ API返回数据格式不正确:', result);
              // 使用上传前检查的结果
              break;
            }
          } else {
            console.warn('[streak-celebration] ⚠️ API请求失败，状态码:', response.status);
            // 使用上传前检查的结果
            break;
          }
        } catch (error) {
          console.warn('[streak-celebration] ❌ 获取连胜数据失败:', error);
          // 使用上传前检查的结果
          break;
        }
      }

      break;
    }

    console.log('[streak-celebration] ========== 最终检查 ==========');
    console.log('[streak-celebration] 检查结果汇总:', {
      isFirst: checkResult?.isFirst,
      newStreak: checkResult?.newStreak,
      previousStreak: checkResult?.previousStreak
    });

    if (checkResult && checkResult.isFirst && checkResult.newStreak > 0) {
      const s = checkResult.newStreak;
      let duration = 3400;
      if (s <= 3) duration = 2600;
      else if (s < 7) duration = 3000;
      else if (s < 30) duration = 3600;
      else if (s < 100) duration = 4000;
      else duration = 4400;

      console.log('[streak-celebration] ✅✅✅ 所有条件满足，准备显示动画！');
      console.log('[streak-celebration] 动画参数:', {
        previousStreak: checkResult.previousStreak,
        newStreak: checkResult.newStreak,
        duration: duration + 'ms'
      });

      return new Promise((resolve) => {
        showStreakCelebration(
          checkResult.previousStreak,
          checkResult.newStreak,
          {
            duration,
            onComplete: () => {
              console.log('[streak-celebration] ✅ 动画完成');
              resolve(true);
            },
          }
        );
      });
    } else {
      console.log('[streak-celebration] ❌ 不满足显示条件:');
      if (!checkResult) {
        console.log('[streak-celebration]   - checkResult 为空');
      } else {
        if (!checkResult.isFirst) {
          console.log('[streak-celebration]   - 不是今天第一次提交');
        }
        if (!checkResult.newStreak || checkResult.newStreak <= 0) {
          console.log('[streak-celebration]   - 连续天数无效:', checkResult.newStreak);
        }
      }
    }

    console.log('[streak-celebration] ========== 检查结束 ==========');
    return false;
  }

  // 直接显示动画（跳过后端检查，用于上传前已检查的情况）
  // checkResult: 上传前检查的结果，包含 previousStreak 和 newStreak
  async function showAnimationDirectly(userId, checkResult) {
    console.log('[streak-celebration] [showAnimationDirectly] 直接显示动画...');
    console.log('[streak-celebration] [showAnimationDirectly] 使用上传前检查的结果:', checkResult);
    
    if (!checkResult || !checkResult.isFirst || !checkResult.newStreak || checkResult.newStreak <= 0) {
      console.warn('[streak-celebration] [showAnimationDirectly] ❌ 检查结果无效:', checkResult);
      return false;
    }

    // 直接使用上传前检查的结果，不重新获取连续天数
    const previousStreak = checkResult.previousStreak || 0;
    const newStreak = checkResult.newStreak;

    console.log('[streak-celebration] [showAnimationDirectly] 使用上传前检查的连续天数:', {
      previousStreak: previousStreak,
      newStreak: newStreak,
      note: '直接使用上传前检查的结果，不重新获取'
    });

    // 更新 localStorage，标记今天已提交
    const todayStr = getTodayDateString();
    const lastSubmissionKey = `last_submission_${userId}`;
    localStorage.setItem(lastSubmissionKey, todayStr);
    
    const s = newStreak;
    let duration = 3400;
    if (s <= 3) duration = 2600;
    else if (s < 7) duration = 3000;
    else if (s < 30) duration = 3600;
    else if (s < 100) duration = 4000;
    else duration = 4400;

    console.log('[streak-celebration] [showAnimationDirectly] ✅✅✅ 准备显示动画！');
    console.log('[streak-celebration] [showAnimationDirectly] 动画参数:', {
      previousStreak: previousStreak,
      newStreak: newStreak,
      duration: duration + 'ms'
    });

    return new Promise((resolve) => {
      showStreakCelebration(
        previousStreak,
        newStreak,
        {
          duration,
          onComplete: () => {
            console.log('[streak-celebration] [showAnimationDirectly] ✅ 动画完成');
            resolve(true);
          },
        }
      );
    });
  }

  window.StreakCelebration = {
    show: showStreakCelebration,
    handleUploadSuccess,
    checkFirstSubmissionToday,
    showAnimationDirectly,
  };

  console.log(
    '[streak-celebration] 连胜庆祝动画模块已加载（紫色主题 + 核心居中 + 艺术字 + Capacitor震动）'
  );
})();