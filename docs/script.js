const CATEGORY_ORDER = ["korea", "us_politics", "world", "finance", "tech"];
const CATEGORY_ICONS = {
  korea: "🇰🇷",
  us_politics: "🇺🇸",
  world: "🌍",
  finance: "💹",
  tech: "💻",
};

function renderStars(starStr) {
  return starStr.split("").map(ch =>
    ch === "★" ? `<span>★</span>` : `<span class="star-off">☆</span>`
  ).join("");
}

function renderNews(data) {
  document.getElementById("generated-at").textContent = "⏱ " + data.generated_at;
  document.getElementById("weekday-label").textContent = "📅 " + data.weekday;

  // 키워드
  const kwSection = document.getElementById("keywords-section");
  if (data.key_keywords && data.key_keywords.length) {
    kwSection.innerHTML = data.key_keywords.map(k =>
      `<span class="keyword-tag">${k}</span>`
    ).join("");
  }

  // 카테고리 그리드
  const grid = document.getElementById("categories-grid");
  grid.innerHTML = "";

  for (const cat of CATEGORY_ORDER) {
    const items = data.categories[cat] || [];
    if (!items.length) continue;

    const icon = CATEGORY_ICONS[cat] || "📌";
    const catName = items[0]?.category_ko || cat;

    const section = document.createElement("section");
    section.className = `category-section cat-${cat}`;
    section.innerHTML = `
      <div class="category-header">
        <div class="category-dot"></div>
        <span class="category-title">${icon} ${catName}</span>
        <span class="category-count">${items.length}건</span>
      </div>
      <ul class="news-list">
        ${items.map((item, i) => `
          <a class="news-item" href="${item.url}" target="_blank" rel="noopener noreferrer">
            <div class="news-rank">#${i + 1}</div>
            <div class="news-body">
              <div class="news-title">${item.title_ko}</div>
              <div class="news-meta">
                <span class="news-stars">${renderStars(item.stars)}</span>
                <span class="news-source">${item.source}</span>
                <span class="news-time">${item.published}</span>
              </div>
              ${item.summary_ko ? `<div class="news-summary">${item.summary_ko}</div>` : ""}
            </div>
          </a>
        `).join("")}
      </ul>
    `;
    grid.appendChild(section);
  }

  // 종합 요약
  if (data.daily_summary) {
    document.getElementById("summary-text").textContent = data.daily_summary;
    document.getElementById("summary-section").classList.remove("hidden");
  }

  document.getElementById("digest-root").classList.remove("hidden");
  document.getElementById("loading-screen").classList.add("hidden");
}

async function load() {
  try {
    const res = await fetch("digest.json?t=" + Date.now());
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    renderNews(data);
  } catch (e) {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("error-screen").classList.remove("hidden");
  }
}

load();
