
    const navItems = document.querySelectorAll(".nav-item");
    const indicator = document.getElementById("indicator");
    const centerBtn = document.getElementById("centerBtn");
    const content = document.getElementById("content");
    const loader = document.getElementById("loader");

    const pageMap = [
      "src/daily.html",
      "case.html",
      "square.html",
      "me.html"
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

    centerBtn.addEventListener("click", () => {
      centerBtn.classList.toggle("rotate");

      if (centerBtn.textContent === "＋") {
        centerBtn.textContent = "❌";
        centerBtn.style.backgroundColor = "red";
      } else {
        centerBtn.textContent = "＋";
        centerBtn.style.backgroundColor = "#6200ea";
      }
    });

    // 初始化加载首页
    updateActive(0);
