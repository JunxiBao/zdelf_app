const navItems = document.querySelectorAll(".nav-item");
const indicator = document.getElementById("indicator");
const centerBtn = document.getElementById("centerBtn");
const content = document.getElementById("content");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modalContent");

const pageMap = [
  "../../src/daily.html",
  "../../src/case.html",
  "../../src/square.html",
  "../../src/me.html"
];

let activeIndex = 0;



function loadPage(index) {
  fetch(pageMap[index])
    .then(res => res.text())
    .then(html => {
      content.innerHTML = html;

      // 动态加载对应的JavaScript文件
      const scriptMap = [
        "../../statics/js/daily.js",
        "../../statics/js/case.js",
        "../../statics/js/square.js",
        "../../statics/js/me.js"
      ];

      if (scriptMap[index]) {
        // 移除旧脚本（如果有）
        const oldScript = document.querySelector(`script[src="${scriptMap[index]}"]`);
        if (oldScript) oldScript.remove();

        // 创建新脚本
        const script = document.createElement("script");
        script.src = scriptMap[index];
        script.onload = () => {
          // 尝试调用初始化函数（如 initDaily、initCase 等）
          const initFunctionName = scriptMap[index]
            .split("/")
            .pop()
            .replace(".js", ""); // 得到 daily、case 等
          const initFunction = window[`init${initFunctionName.charAt(0).toUpperCase()}${initFunctionName.slice(1)}`];
          if (typeof initFunction === "function") {
            initFunction();
          }
        };
        document.body.appendChild(script);

        console.log("📦 动态加载脚本:", scriptMap[index]);
      }
    })
    .catch(err => {
      content.innerHTML = "<p style='padding: 2em; text-align:center;'>⚠️ 页面加载失败</p>";
      console.error("加载页面出错:", err);
    });
}


document.querySelectorAll('.nav-item').forEach(item => {
  ['mousedown', 'touchstart'].forEach(evt => {
    item.addEventListener(evt, function (e) {
      const targetButton = item.querySelector('.icon');
      if (!targetButton) return;
      const circle = document.createElement('span');
      circle.classList.add('ripple-effect');
      const rect = targetButton.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      circle.style.width = circle.style.height = size + 'px';
      circle.style.left = e.clientX - rect.left - size / 2 + 'px';
      circle.style.top = e.clientY - rect.top - size / 2 + 'px';
      const existing = targetButton.querySelector('.ripple-effect');
      if (existing) existing.remove();
      targetButton.appendChild(circle);
    });
  });
});

function updateActive(index) {
  navItems.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  indicator.style.transform = `translateX(${index * 100}%)`;
  activeIndex = index;

  loadPage(index);
}

navItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    updateActive(index);
  });
});

function openModal() {
  modal.style.display = "flex";
  modalContent.innerHTML = '<div style="text-align:center;padding:2em;">加载中...</div>';

  fetch("../../src/add.html")
    .then(res => res.text())
    .then(html => {
      modalContent.innerHTML = html;
      // 动态加载 add.js
      const script = document.createElement("script");
      script.src = "../../statics/js/add.js";
      modalContent.appendChild(script);
    })
    .catch(() => {
      modalContent.innerHTML = "<p style='text-align:center;'>⚠️ 无法加载内容</p>";
    });
}

function closeModal() {
  modalContent.classList.add("closing");
  modalContent.addEventListener("animationend", function handler() {
    modal.style.display = "none";
    modalContent.classList.remove("closing");
    modalContent.innerHTML = "";
    modalContent.removeEventListener("animationend", handler);
  });
}

centerBtn.addEventListener("click", () => {
  const isOpen = modal.style.display === "flex";

  if (isOpen) {
    closeModal();
    centerBtn.classList.remove("rotate");
  } else {
    openModal();
    centerBtn.classList.add("rotate");
  }
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal();
    centerBtn.classList.remove("rotate");
  }
});

// 确保页面完全加载后再初始化首页内容
document.addEventListener("DOMContentLoaded", () => {
  updateActive(0);
});