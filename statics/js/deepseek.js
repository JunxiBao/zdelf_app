// Lightweight haptics bridge for standalone page (only if not already provided)
try {
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
} catch(_) {}

marked.setOptions({ breaks: true });

// Backend API base: use absolute by default, allow override via window.__API_BASE__
const __API_BASE_DEFAULT__ = (typeof window !== "undefined" && window.__API_BASE__) || "https://app.zdelf.cn";
const __API_BASE__ = __API_BASE_DEFAULT__ && __API_BASE_DEFAULT__.endsWith("/")
  ? __API_BASE_DEFAULT__.slice(0, -1)
  : __API_BASE_DEFAULT__;

function generateGreeting() {
  const hour = new Date().getHours();
  let greet = "您好！有什么健康问题尽管问我哦~";
  if (hour >= 5 && hour < 11)
    greet = "早上好 ☀️，我可以帮你分析饮食、作息或体检报告。";
  else if (hour < 14) greet = "中午好 🍵，注意补水，有什么想问的？";
  else if (hour < 18) greet = "下午好 🌿，需要我看看你的训练/饮食计划吗？";
  else greet = "晚上好 🌙，今天感觉怎么样？我可以帮你做个总结。";
  addMessage(greet, "bot");
}

window.addEventListener("DOMContentLoaded", function() {
  generateGreeting();

  // 为输入框添加键盘事件监听，增强震动反馈
  const inputEl = document.getElementById("userInput");
  if (inputEl) {
    inputEl.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        // Enter键发送消息时的震动反馈
        try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
      }
    });
  }
});

function addTypingBubble() {
  const msgList = document.getElementById("messageList");
  const wrap = document.createElement("div");
  wrap.className = "message bot typing";
  wrap.innerHTML =
    '<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>';
  msgList.appendChild(wrap);
  msgList.scrollTop = msgList.scrollHeight;
  return wrap;
}

async function sendMessage() {
  const inputEl = document.getElementById("userInput");
  const message = inputEl.value.trim();
  if (!message) return;

  // 发送消息时的震动反馈
  try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}

  inputEl.disabled = true;

  addMessage(message, "user");
  inputEl.value = "";

  const thinkingMsg = addTypingBubble();

  try {
    const response = await fetch(__API_BASE__ + "/deepseek/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    if (response.ok) {
      thinkingMsg.classList.remove("typing");
      thinkingMsg.innerHTML = marked.parse(data.reply);
      Prism.highlightAll();
    } else {
      thinkingMsg.textContent = "❌ 出错了：" + (data.error || "未知错误");
    }
  } catch (error) {
    thinkingMsg.classList.remove("typing");
    thinkingMsg.textContent = "⚠️ 无法连接服务器：" + error.message;
  }
  inputEl.disabled = false;
  inputEl.focus();
}

function addMessage(text, sender, returnElement = false) {
  const msgList = document.getElementById("messageList");
  const msgDiv = document.createElement("div");
  msgDiv.className = "message " + sender;
  const content = document.createElement("div");
  content.className = "msg-content";

  if (sender === "bot") {
    content.innerHTML = marked.parse(text);
  } else {
    content.textContent = text;
  }
  msgDiv.appendChild(content);
  msgList.appendChild(msgDiv);
  msgList.scrollTop = msgList.scrollHeight;
  Prism.highlightAll();
  return returnElement ? msgDiv : undefined;
}

// ========================================
// Square.js functionality integration
// 集成square.js的功能
// ========================================

// Array of teardown callbacks to run when leaving the page
let cleanupFns = [];
let currentShadowRoot = null;

/**
 * Initialize the AI Assistant page UI.
 * @param {Document|ShadowRoot} rootEl - Scope for DOM queries.
 */
function initSquare(rootEl) {
  const root = rootEl || document;
  currentShadowRoot = root;

  // 直接加载DeepSeek.html内容
  loadDeepSeekContent(root);

  console.log('✅ initSquare 执行，AI助手页面已初始化');
}

/**
 * 加载DeepSeek.html内容
 */
function loadDeepSeekContent(root) {
  // 创建iframe来直接加载DeepSeek.html
  const iframe = document.createElement('iframe');
  iframe.src = '../src/deepseek.html';
  iframe.style.cssText = `
    width: 100%;
    height: calc(100vh - 80px);
    border: none;
    background: white;
  `;
  
  iframe.onload = () => {
    console.log('✅ DeepSeek.html 加载完成');
  };
  
  iframe.onerror = () => {
    console.error('❌ DeepSeek.html 加载失败');
    root.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #333;">
        <h3>AI助手暂时无法访问</h3>
        <p>请检查网络连接或稍后重试</p>
      </div>
    `;
  };

  // 清空root内容并添加iframe
  root.innerHTML = '';
  root.appendChild(iframe);
}

/**
 * Cleanup function: run all stored teardown callbacks.
 * Called before leaving the page to prevent leaks.
 */
function destroySquare() {
  // 清理iframe
  if (currentShadowRoot) {
    const iframe = currentShadowRoot.querySelector('iframe');
    if (iframe) {
      iframe.src = '';
      iframe.remove();
    }
  }

  // 统一执行清理函数
  cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
  cleanupFns = [];
  currentShadowRoot = null;

  console.log('🧹 destroySquare 清理完成');
}

// Expose lifecycle functions to global scope for loader
console.debug("[deepseek] exposing lifecycle: initSquare/destroySquare");
window.initSquare = initSquare;
window.destroySquare = destroySquare;
