const navItems = document.querySelectorAll(".nav-item");
const indicator = document.getElementById("indicator");
const centerBtn = document.getElementById("centerBtn");
const content = document.getElementById("content");
const loader = document.getElementById("loader");
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
  loader.style.display = "flex";

  fetch(pageMap[index])
    .then(res => res.text())
    .then(html => {
      content.innerHTML = html;
    })
    .catch(err => {
      content.innerHTML = "<p>Error loading page.</p>";
      console.error(err);
    })
    .finally(() => {
      setTimeout(() => {
        loader.style.display = "none";
      }, 400); // 增加加载动效显示时长
    });
}

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
    })
    .catch(() => {
      modalContent.innerHTML = "<p>无法加载内容</p>";
    });
}

function closeModal() {
  // 添加关闭动画
  modalContent.classList.add("closing");
  modalContent.addEventListener("animationend", function handler() {
    modal.style.display = "none";
    modalContent.classList.remove("closing");
    modalContent.innerHTML = "";
    modalContent.removeEventListener("animationend", handler);
  });
}

centerBtn.addEventListener("click", () => {
  centerBtn.classList.toggle("rotate");

  if (centerBtn.textContent === "＋") {
    openModal();
  } else {
    centerBtn.textContent = "＋";
    centerBtn.style.backgroundColor = "#6200ea";
    closeModal();
  }
});

// 点击弹窗外区域关闭弹窗
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    centerBtn.textContent = "＋";
    centerBtn.style.backgroundColor = "#6200ea";
    closeModal();
  }
});

document.getElementById('modalCloseBtn').onclick = function() {
  centerBtn.textContent = "＋";
  centerBtn.style.backgroundColor = "#6200ea";
  closeModal();
};

// 初始化加载首页
updateActive(0);
