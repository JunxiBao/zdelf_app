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

window.addEventListener("DOMContentLoaded", generateGreeting);

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
